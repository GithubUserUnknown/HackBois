#!/usr/bin/env python3
"""
FastAPI Backend for SUMO Traffic Simulation Control
Provides REST API and WebSocket for real-time simulation control and visualization
"""

import os
import sys
import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import torch

# SUMO imports
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")

import traci

# RL Controller
from rl_controller import RLController, get_available_models

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="SUMO Traffic Control API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
class SimulationState:
    def __init__(self):
        self.is_running = False
        self.is_paused = False
        self.current_step = 0
        self.config = {}
        self.websocket_clients: List[WebSocket] = []
        self.sumo_process = None
        self.simulation_speed = 1.0  # Default 1x speed (normal speed)
        self.alerts: List[Dict] = []  # Store recent alerts
        self.rl_controller: Optional[RLController] = None  # RL controller instance

sim_state = SimulationState()

# Pydantic models
class SimulationConfig(BaseModel):
    gui_mode: bool = False
    step_length: float = 1.0
    traffic_volume: int = 75
    enable_rl: bool = False
    rl_algorithm: str = 'ppo'  # 'ppo', 'dqn', 'fixed', 'actuated'
    rl_model: Optional[str] = None  # Model name to load (optional)
    emergency_frequency: int = 10
    max_steps: int = 3600
    simulation_speed: float = 1.0  # Simulation speed multiplier (default 1x for normal speed)

class ControlCommand(BaseModel):
    action: str  # 'start', 'pause', 'resume', 'stop', 'step', 'set_speed'
    config: Optional[SimulationConfig] = None
    speed: Optional[float] = None  # For set_speed action

class TrafficLightControl(BaseModel):
    intersection_id: str
    phase: int
    duration: Optional[int] = None

class Alert(BaseModel):
    id: str
    type: str  # 'congestion', 'emergency_vehicle', 'accident'
    severity: str  # 'low', 'medium', 'high', 'critical'
    location: str
    description: str
    timestamp: str
    data: Optional[Dict[str, Any]] = None

# Helper functions
def get_sumo_cmd(config: SimulationConfig) -> List[str]:
    """Generate SUMO command based on configuration"""
    cmd = ["sumo-gui" if config.gui_mode else "sumo"]
    cmd.extend(["-c", "Grid-1.sumocfg"])
    cmd.extend(["--step-length", str(config.step_length)])
    
    if config.gui_mode:
        cmd.extend(["--delay", "100"])
    
    cmd.extend([
        "--waiting-time-memory", "1000",
        "--time-to-teleport", "-1",
        "--no-step-log", "true"
    ])
    
    if not config.gui_mode:
        cmd.extend(["--no-warnings", "true"])
    
    return cmd

def get_simulation_state() -> Dict[str, Any]:
    """Get current simulation state from SUMO"""
    if not traci.isLoaded():
        return {"error": "Simulation not running"}
    
    try:
        # Get all vehicles
        vehicles = []
        for veh_id in traci.vehicle.getIDList():
            try:
                pos = traci.vehicle.getPosition(veh_id)
                speed = traci.vehicle.getSpeed(veh_id)
                vtype = traci.vehicle.getTypeID(veh_id)
                angle = traci.vehicle.getAngle(veh_id)
                waiting_time = traci.vehicle.getWaitingTime(veh_id)
                
                vehicles.append({
                    "id": veh_id,
                    "position": {"x": pos[0], "y": pos[1]},
                    "speed": speed,
                    "type": vtype,
                    "angle": angle,
                    "waiting_time": waiting_time
                })
            except:
                continue
        
        # Get all traffic lights
        traffic_lights = []
        for tl_id in traci.trafficlight.getIDList():
            try:
                state = traci.trafficlight.getRedYellowGreenState(tl_id)
                phase = traci.trafficlight.getPhase(tl_id)
                next_switch = traci.trafficlight.getNextSwitch(tl_id)
                controlled_lanes = traci.trafficlight.getControlledLanes(tl_id)
                
                traffic_lights.append({
                    "id": tl_id,
                    "state": state,
                    "phase": phase,
                    "next_switch": next_switch,
                    "controlled_lanes": controlled_lanes
                })
            except:
                continue
        
        # Get metrics
        metrics = {
            "current_time": traci.simulation.getTime(),
            "vehicle_count": len(vehicles),
            "arrived_vehicles": traci.simulation.getArrivedNumber(),
            "departed_vehicles": traci.simulation.getDepartedNumber(),
            "waiting_time": sum(v["waiting_time"] for v in vehicles),
            "avg_speed": sum(v["speed"] for v in vehicles) / len(vehicles) if vehicles else 0
        }
        
        return {
            "vehicles": vehicles,
            "traffic_lights": traffic_lights,
            "metrics": metrics,
            "step": sim_state.current_step
        }
    except Exception as e:
        logger.error(f"Error getting simulation state: {e}")
        return {"error": str(e)}

def detect_alerts():
    """Detect congestion and emergency vehicles and generate alerts"""
    alerts = []

    try:
        if not traci.isLoaded():
            return alerts

        # Get all vehicles
        vehicle_ids = traci.vehicle.getIDList()

        # Track congestion by edge
        edge_vehicles = {}
        for vid in vehicle_ids:
            try:
                edge_id = traci.vehicle.getRoadID(vid)
                if edge_id and not edge_id.startswith(':'):  # Skip internal edges
                    if edge_id not in edge_vehicles:
                        edge_vehicles[edge_id] = []
                    edge_vehicles[edge_id].append(vid)
            except:
                continue

        # Detect congestion (more than 5 vehicles on an edge with low average speed)
        for edge_id, vehicles in edge_vehicles.items():
            if len(vehicles) >= 5:
                try:
                    avg_speed = sum(traci.vehicle.getSpeed(vid) for vid in vehicles) / len(vehicles)
                    avg_waiting = sum(traci.vehicle.getWaitingTime(vid) for vid in vehicles) / len(vehicles)

                    if avg_speed < 2.0 and avg_waiting > 10.0:  # Congestion criteria
                        severity = 'critical' if avg_waiting > 30 else 'high' if avg_waiting > 20 else 'medium'
                        alerts.append({
                            'id': f'congestion_{edge_id}_{sim_state.current_step}',
                            'type': 'congestion',
                            'severity': severity,
                            'location': edge_id,
                            'description': f'Traffic congestion detected on {edge_id}',
                            'timestamp': datetime.now().isoformat(),
                            'data': {
                                'vehicle_count': len(vehicles),
                                'avg_speed': round(avg_speed, 2),
                                'avg_waiting_time': round(avg_waiting, 2)
                            }
                        })
                except:
                    continue

        # Detect emergency vehicles
        for vid in vehicle_ids:
            try:
                vtype = traci.vehicle.getTypeID(vid)
                if vtype in ['emergency', 'ambulance', 'firetruck', 'police']:
                    speed = traci.vehicle.getSpeed(vid)
                    waiting_time = traci.vehicle.getWaitingTime(vid)
                    edge_id = traci.vehicle.getRoadID(vid)

                    # Alert if emergency vehicle is stuck
                    if waiting_time > 5.0:
                        alerts.append({
                            'id': f'emergency_{vid}_{sim_state.current_step}',
                            'type': 'emergency_vehicle',
                            'severity': 'critical',
                            'location': edge_id,
                            'description': f'Emergency vehicle {vid} is stuck in traffic',
                            'timestamp': datetime.now().isoformat(),
                            'data': {
                                'vehicle_id': vid,
                                'vehicle_type': vtype,
                                'speed': round(speed, 2),
                                'waiting_time': round(waiting_time, 2)
                            }
                        })
                    # Alert when emergency vehicle is active
                    elif speed > 0.1:
                        alerts.append({
                            'id': f'emergency_active_{vid}_{sim_state.current_step}',
                            'type': 'emergency_vehicle',
                            'severity': 'high',
                            'location': edge_id,
                            'description': f'Emergency vehicle {vid} is responding',
                            'timestamp': datetime.now().isoformat(),
                            'data': {
                                'vehicle_id': vid,
                                'vehicle_type': vtype,
                                'speed': round(speed, 2)
                            }
                        })
            except:
                continue

    except Exception as e:
        logger.error(f"Error detecting alerts: {e}")

    return alerts

async def broadcast_state():
    """Broadcast current state to all connected WebSocket clients"""
    if sim_state.websocket_clients:
        state = get_simulation_state()

        # Detect and add alerts
        new_alerts = detect_alerts()
        if new_alerts:
            # Keep only last 50 alerts
            sim_state.alerts.extend(new_alerts)
            sim_state.alerts = sim_state.alerts[-50:]

        # Add alerts to state
        state['alerts'] = new_alerts
        state['all_alerts'] = sim_state.alerts[-10:]  # Last 10 alerts

        message = json.dumps(state)

        # Remove disconnected clients
        disconnected = []
        for client in sim_state.websocket_clients:
            try:
                await client.send_text(message)
            except:
                disconnected.append(client)

        for client in disconnected:
            if client in sim_state.websocket_clients:
                sim_state.websocket_clients.remove(client)

# API Endpoints
@app.get("/")
async def root():
    return {"message": "SUMO Traffic Control API", "version": "1.0.0"}

@app.get("/status")
async def get_status():
    """Get current simulation status"""
    return {
        "is_running": sim_state.is_running,
        "is_paused": sim_state.is_paused,
        "current_step": sim_state.current_step,
        "config": sim_state.config,
        "connected_clients": len(sim_state.websocket_clients),
        "simulation_speed": sim_state.simulation_speed,
        "alert_count": len(sim_state.alerts)
    }

@app.get("/alerts")
async def get_alerts():
    """Get recent alerts"""
    return {
        "alerts": sim_state.alerts[-20:],  # Last 20 alerts
        "total_count": len(sim_state.alerts)
    }

@app.get("/rl/models")
async def get_rl_models():
    """Get available RL models"""
    try:
        models = get_available_models()

        # Add algorithm options
        algorithms = [
            {
                "id": "ppo",
                "name": "PPO (Proximal Policy Optimization)",
                "description": "Advanced RL algorithm with stable training",
                "requires_model": False
            },
            {
                "id": "dqn",
                "name": "DQN (Deep Q-Network)",
                "description": "Value-based RL algorithm",
                "requires_model": False
            },
            {
                "id": "a3c",
                "name": "A3C (Asynchronous Advantage Actor-Critic)",
                "description": "Asynchronous RL algorithm for parallel training",
                "requires_model": False
            },
            {
                "id": "fixed",
                "name": "Fixed-Time Control",
                "description": "Traditional fixed-time traffic signals (30s cycles)",
                "requires_model": False
            },
            {
                "id": "actuated",
                "name": "Actuated Control",
                "description": "Traffic-responsive control based on queue lengths",
                "requires_model": False
            }
        ]

        return {
            "algorithms": algorithms,
            "trained_models": models,
            "default_algorithm": "ppo"
        }
    except Exception as e:
        logger.error(f"Error getting RL models: {e}")
        return {
            "algorithms": [],
            "trained_models": [],
            "error": str(e)
        }

@app.get("/rl/info")
async def get_rl_info():
    """Get current RL controller information"""
    if sim_state.rl_controller:
        return {
            "enabled": True,
            "info": sim_state.rl_controller.get_info()
        }
    else:
        return {
            "enabled": False,
            "info": None
        }

@app.post("/control")
async def control_simulation(command: ControlCommand):
    """Control simulation (start, pause, resume, stop)"""
    try:
        if command.action == "start":
            if sim_state.is_running:
                raise HTTPException(status_code=400, detail="Simulation already running")

            config = command.config or SimulationConfig()
            sim_state.config = config.model_dump()
            sim_state.simulation_speed = config.simulation_speed

            # Start SUMO
            sumo_cmd = get_sumo_cmd(config)
            logger.info(f"Starting SUMO: {' '.join(sumo_cmd)}")
            traci.start(sumo_cmd)

            sim_state.is_running = True
            sim_state.is_paused = False
            sim_state.current_step = 0
            sim_state.alerts = []  # Clear alerts

            # Initialize RL controller if enabled
            if config.enable_rl:
                try:
                    sim_state.rl_controller = RLController(
                        algorithm=config.rl_algorithm,
                        model_path=config.rl_model,
                        device='cuda' if torch.cuda.is_available() else 'cpu'
                    )
                    sim_state.rl_controller.initialize_traffic_lights()
                    logger.info(f"RL Controller initialized: {config.rl_algorithm}")
                except Exception as e:
                    logger.error(f"Failed to initialize RL controller: {e}")
                    sim_state.rl_controller = None
            else:
                sim_state.rl_controller = None

            return {
                "status": "started",
                "config": sim_state.config,
                "simulation_speed": sim_state.simulation_speed,
                "rl_enabled": sim_state.rl_controller is not None,
                "rl_info": sim_state.rl_controller.get_info() if sim_state.rl_controller else None
            }
        
        elif command.action == "pause":
            if not sim_state.is_running:
                raise HTTPException(status_code=400, detail="Simulation not running")
            sim_state.is_paused = True
            return {"status": "paused"}
        
        elif command.action == "resume":
            if not sim_state.is_running:
                raise HTTPException(status_code=400, detail="Simulation not running")
            sim_state.is_paused = False
            return {"status": "resumed"}
        
        elif command.action == "stop":
            try:
                if traci.isLoaded():
                    traci.close()
            except Exception as e:
                logger.warning(f"Error closing TraCI (may already be closed): {e}")

            # Reset RL controller
            if sim_state.rl_controller:
                sim_state.rl_controller.reset()
                sim_state.rl_controller = None

            sim_state.is_running = False
            sim_state.is_paused = False
            sim_state.current_step = 0
            return {"status": "stopped"}
        
        elif command.action == "step":
            if not sim_state.is_running or sim_state.is_paused:
                raise HTTPException(status_code=400, detail="Simulation not running or paused")

            # Execute ONE simulation step (speed only affects frontend update rate, not SUMO steps)
            if not traci.isLoaded():
                logger.warning("TraCI connection lost - simulation may have been closed")
                sim_state.is_running = False
                sim_state.is_paused = False
                return {"status": "stopped", "reason": "connection_lost"}

            try:
                # Apply RL control if enabled
                if sim_state.rl_controller:
                    try:
                        sim_state.rl_controller.step()
                    except Exception as e:
                        logger.error(f"Error in RL controller step: {e}")

                traci.simulationStep()
                sim_state.current_step += 1

                # Check if simulation has ended
                if traci.simulation.getMinExpectedNumber() <= 0:
                    logger.info("Simulation completed - no more vehicles")
                    sim_state.is_running = False
                    return {"status": "completed", "step": sim_state.current_step}

            except traci.exceptions.FatalTraCIError as e:
                logger.error(f"TraCI connection error: {e}")
                sim_state.is_running = False
                sim_state.is_paused = False
                return {"status": "error", "message": "SUMO connection lost"}

            # Broadcast state to WebSocket clients
            await broadcast_state()

            return {"status": "stepped", "step": sim_state.current_step, "speed": sim_state.simulation_speed}

        elif command.action == "set_speed":
            if command.speed is not None:
                sim_state.simulation_speed = max(0.1, min(100.0, command.speed))  # Clamp between 0.1x and 100x
                logger.info(f"Simulation speed set to {sim_state.simulation_speed}x")
                return {"status": "speed_updated", "simulation_speed": sim_state.simulation_speed}
            else:
                raise HTTPException(status_code=400, detail="Speed parameter required for set_speed action")

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {command.action}")
    
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e) if str(e) else f"{type(e).__name__}: {repr(e)}"
        logger.error(f"Error in control_simulation: {error_msg}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/state")
async def get_state():
    """Get current simulation state"""
    if not sim_state.is_running:
        raise HTTPException(status_code=400, detail="Simulation not running")
    
    return get_simulation_state()

@app.post("/traffic-light")
async def control_traffic_light(control: TrafficLightControl):
    """Control a specific traffic light"""
    if not sim_state.is_running:
        raise HTTPException(status_code=400, detail="Simulation not running")
    
    try:
        traci.trafficlight.setPhase(control.intersection_id, control.phase)
        if control.duration:
            traci.trafficlight.setPhaseDuration(control.intersection_id, control.duration)
        
        return {"status": "success", "intersection": control.intersection_id, "phase": control.phase}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/network-info")
async def get_network_info():
    """Get SUMO network information"""
    try:
        # Read network file
        import xml.etree.ElementTree as ET
        tree = ET.parse("grid3x3.net.xml")
        root = tree.getroot()
        
        # Get junctions (intersections)
        junctions = []
        for junction in root.findall('junction'):
            if junction.get('type') == 'traffic_light':
                junctions.append({
                    "id": junction.get('id'),
                    "x": float(junction.get('x', 0)),
                    "y": float(junction.get('y', 0)),
                    "type": junction.get('type')
                })
        
        # Get edges (roads)
        edges = []
        for edge in root.findall('edge'):
            edge_id = edge.get('id')
            if not edge_id.startswith(':'):  # Skip internal edges
                edges.append({
                    "id": edge_id,
                    "from": edge.get('from'),
                    "to": edge.get('to')
                })
        
        return {
            "junctions": junctions,
            "edges": edges
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time simulation updates"""
    await websocket.accept()
    sim_state.websocket_clients.append(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(sim_state.websocket_clients)}")
    
    try:
        while True:
            # Keep connection alive and listen for messages
            data = await websocket.receive_text()
            # Echo back or handle commands if needed
            await websocket.send_text(json.dumps({"echo": data}))
    except WebSocketDisconnect:
        sim_state.websocket_clients.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(sim_state.websocket_clients)}")

if __name__ == "__main__":
    # Change to Traffic Reinforcement directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    logger.info("Starting SUMO API Server...")
    logger.info(f"Working directory: {os.getcwd()}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

