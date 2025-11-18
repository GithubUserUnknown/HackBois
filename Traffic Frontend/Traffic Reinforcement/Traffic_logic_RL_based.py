"""
Advanced RL-Based Traffic Signal Control for SUMO 3x3 Grid
Supports DQN, PPO, and A3C algorithms with emergency vehicle priority

IMPROVEMENTS:
- Dynamic configuration loading from YAML
- Automatic network parsing from .net.xml
- Flexible action space with keep/switch options
- Comprehensive error handling and logging
- TensorBoard integration for experiment tracking
- Command-line argument support
"""

import os
import sys
import numpy as np
import random
import xml.etree.ElementTree as ET
from collections import deque, defaultdict
import pickle
import json
import yaml
import argparse
import logging
from datetime import datetime
from pathlib import Path

# Deep Learning
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from torch.distributions import Categorical
from torch.utils.tensorboard import SummaryWriter

# SUMO
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")

import traci
import sumolib


# ==================== LOGGING SETUP ====================
def setup_logging(log_level="INFO", log_file=None, console_output=True):
    """Setup logging configuration"""
    logger = logging.getLogger("TrafficRL")
    logger.setLevel(getattr(logging, log_level.upper()))

    # Clear existing handlers
    logger.handlers.clear()

    # Format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Console handler
    if console_output:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    # File handler
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


# ==================== NETWORK UTILITIES ====================
def load_traffic_lights_from_network(net_file):
    """Dynamically load traffic light IDs from SUMO network file"""
    logger = logging.getLogger("TrafficRL")
    try:
        tree = ET.parse(net_file)
        root = tree.getroot()

        # Find all junctions with type="traffic_light"
        tls_ids = []
        for junction in root.findall('junction'):
            if junction.get('type') == 'traffic_light':
                tls_ids.append(junction.get('id'))

        logger.info(f"Loaded {len(tls_ids)} traffic lights from {net_file}: {tls_ids}")
        return sorted(tls_ids)
    except Exception as e:
        logger.error(f"Failed to load traffic lights from {net_file}: {e}")
        # Fallback to default 3x3 grid
        return [f"n{i}{j}" for i in range(3) for j in range(3)]


def get_edge_info_from_network(net_file):
    """Extract edge information from network file"""
    logger = logging.getLogger("TrafficRL")
    try:
        tree = ET.parse(net_file)
        root = tree.getroot()

        edges = {}
        for edge in root.findall('edge'):
            edge_id = edge.get('id')
            if not edge_id.startswith(':'):  # Skip internal edges
                edges[edge_id] = {
                    'from': edge.get('from'),
                    'to': edge.get('to'),
                    'function': edge.get('function', 'normal')
                }

        logger.info(f"Loaded {len(edges)} edges from network")
        return edges
    except Exception as e:
        logger.error(f"Failed to load edges from {net_file}: {e}")
        return {}


# ==================== CONFIGURATION ====================
class Config:
    """Configuration class with dynamic loading from YAML"""

    def __init__(self, config_file="config.yaml", **kwargs):
        """Load configuration from YAML file with optional overrides"""
        self.logger = logging.getLogger("TrafficRL")

        # Load from YAML
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config_data = yaml.safe_load(f)
            self.logger.info(f"Loaded configuration from {config_file}")
        else:
            self.logger.warning(f"Config file {config_file} not found, using defaults")
            config_data = {}

        # Network settings
        network = config_data.get('network', {})
        self.NET_FILE = network.get('net_file', 'grid3x3.net.xml')
        self.ROUTE_FILE = network.get('route_file', 'routes.rou.xml')
        self.DETECTOR_FILE = network.get('detector_file', 'lane_area_detectors.add.xml')
        self.SUMOCFG_FILE = network.get('sumocfg_file', 'Grid-1.sumocfg')

        # Load intersections dynamically or from config
        if network.get('auto_detect_intersections', True):
            self.INTERSECTIONS = load_traffic_lights_from_network(self.NET_FILE)
        else:
            self.INTERSECTIONS = network.get('manual_intersections',
                                            [f"n{i}{j}" for i in range(3) for j in range(3)])

        # Load edge information
        self.EDGES = get_edge_info_from_network(self.NET_FILE)

        # Simulation settings
        sim = config_data.get('simulation', {})
        self.EPISODE_DURATION = sim.get('episode_duration', 3600)
        self.CONGESTION_THRESHOLD = sim.get('congestion_threshold', 0.7)
        self.DETECTOR_LENGTH = sim.get('detector_length', 80)
        self.YELLOW_PHASE_DURATION = sim.get('yellow_phase_duration', 3)
        self.STEP_LENGTH = sim.get('step_length', 1.0)
        self.GUI_MODE = sim.get('gui_mode', False)
        self.GUI_DELAY = sim.get('gui_delay', 100)

        # Traffic signal settings
        tls = config_data.get('traffic_signal', {})
        self.MIN_PHASE_DURATION = tls.get('min_phase_duration', 12)
        self.MAX_PHASE_DURATION = tls.get('max_phase_duration', 30)
        self.ALLOW_PHASE_KEEP = tls.get('allow_phase_keep', True)
        self.DYNAMIC_DURATION = tls.get('dynamic_duration', True)

        # Training parameters
        train = config_data.get('training', {})
        self.LEARNING_RATE = train.get('learning_rate', 0.0003)
        self.GAMMA = train.get('gamma', 0.99)
        self.BATCH_SIZE = train.get('batch_size', 64)
        self.MEMORY_SIZE = train.get('memory_size', 10000)
        self.EPSILON_START = train.get('epsilon_start', 1.0)
        self.EPSILON_END = train.get('epsilon_end', 0.01)
        self.EPSILON_DECAY = train.get('epsilon_decay', 0.995)
        self.TARGET_UPDATE = train.get('target_update', 10)
        self.PPO_EPOCHS = train.get('ppo_epochs', 4)
        self.PPO_CLIP = train.get('ppo_clip', 0.2)
        self.PPO_ENTROPY_COEF = train.get('ppo_entropy_coef', 0.01)
        self.HIDDEN_SIZE = train.get('hidden_size', 256)
        self.DROPOUT = train.get('dropout', 0.2)
        self.NUM_EPISODES = train.get('num_episodes', 100)
        self.SAVE_INTERVAL = train.get('save_interval', 10)
        self.EVAL_EPISODES = train.get('eval_episodes', 5)

        # Priority weights
        self.PRIORITY_WEIGHTS = config_data.get('priority_weights', {
            'ambulance': 10, 'firetruck': 10, 'police': 7,
            'truck': 4, 'bus': 4, 'car': 3, 'auto': 2, 'bike': 1
        })

        # Reward weights
        self.REWARD_WEIGHTS = config_data.get('reward_weights', {
            'emergency_waiting': -5.0, 'normal_waiting': -0.1,
            'throughput': 0.5, 'speed': 0.2, 'queue': -0.3,
            'pressure': -0.2, 'phase_change': -2.0
        })

        # Logging settings
        log_config = config_data.get('logging', {})
        self.LOG_LEVEL = log_config.get('level', 'INFO')
        self.LOG_FILE = log_config.get('log_file', 'logs/training.log')
        self.CONSOLE_OUTPUT = log_config.get('console_output', True)

        # Experiment tracking
        exp = config_data.get('experiment', {})
        self.USE_TENSORBOARD = exp.get('use_tensorboard', True)
        self.TENSORBOARD_DIR = exp.get('tensorboard_dir', 'runs')
        self.SAVE_DIR = exp.get('save_dir', 'models')
        self.TRACK_METRICS = exp.get('track_metrics', [
            'episode_reward', 'total_waiting_time', 'total_throughput',
            'emergency_delays', 'avg_speed', 'congestion_level', 'loss'
        ])

        # Device settings
        device_config = config_data.get('device', {})
        use_cuda = device_config.get('use_cuda', True)
        cuda_device = device_config.get('cuda_device', 0)
        self.DEVICE = torch.device(
            f'cuda:{cuda_device}' if use_cuda and torch.cuda.is_available() else 'cpu'
        )

        # Calculated dynamically
        self.STATE_SIZE = None
        self.ACTION_SIZE = None

        # Apply command-line overrides
        for key, value in kwargs.items():
            if hasattr(self, key.upper()):
                setattr(self, key.upper(), value)
                self.logger.info(f"Override: {key.upper()} = {value}")

    def get_sumo_cmd(self):
        """Generate SUMO command based on configuration"""
        cmd = ["sumo-gui" if self.GUI_MODE else "sumo"]
        cmd.extend(["-c", self.SUMOCFG_FILE])
        cmd.extend(["--step-length", str(self.STEP_LENGTH)])

        if self.GUI_MODE:
            cmd.extend(["--delay", str(self.GUI_DELAY)])

        cmd.extend([
            "--waiting-time-memory", "1000",
            "--time-to-teleport", "-1",
            "--no-step-log", "true"
        ])

        if not self.GUI_MODE:
            cmd.extend(["--no-warnings", "true"])

        return cmd


# ==================== NEURAL NETWORKS ====================

class DQNNetwork(nn.Module):
    """Deep Q-Network with neighbor awareness"""
    def __init__(self, state_size, action_size, hidden_size=256):
        super(DQNNetwork, self).__init__()
        self.fc1 = nn.Linear(state_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, hidden_size // 2)
        self.fc4 = nn.Linear(hidden_size // 2, action_size)
        self.dropout = nn.Dropout(0.2)

        # Initialize weights properly
        self._initialize_weights()

    def _initialize_weights(self):
        """Initialize network weights using Xavier initialization"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight, gain=0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0.0)

    def forward(self, x):
        # Clamp input to prevent extreme values
        x = torch.clamp(x, -10.0, 10.0)

        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = F.relu(self.fc2(x))
        x = self.dropout(x)
        x = F.relu(self.fc3(x))
        x = self.fc4(x)
        return x


class ActorCritic(nn.Module):
    """Actor-Critic network for PPO and A3C"""
    def __init__(self, state_size, action_size, hidden_size=256):
        super(ActorCritic, self).__init__()
        
        # Shared layers
        self.shared_fc1 = nn.Linear(state_size, hidden_size)
        self.shared_fc2 = nn.Linear(hidden_size, hidden_size)

        # Actor head
        self.actor_fc = nn.Linear(hidden_size, hidden_size // 2)
        self.actor_out = nn.Linear(hidden_size // 2, action_size)

        # Critic head
        self.critic_fc = nn.Linear(hidden_size, hidden_size // 2)
        self.critic_out = nn.Linear(hidden_size // 2, 1)

        self.dropout = nn.Dropout(0.2)

        # Initialize weights properly to prevent NaN
        self._initialize_weights()

    def _initialize_weights(self):
        """Initialize network weights using Xavier initialization"""
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight, gain=0.01)
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0.0)

    def forward(self, x):
        # Clamp input to prevent extreme values
        x = torch.clamp(x, -10.0, 10.0)

        x = F.relu(self.shared_fc1(x))
        x = self.dropout(x)
        x = F.relu(self.shared_fc2(x))

        # Actor
        actor = F.relu(self.actor_fc(x))
        action_logits = self.actor_out(actor)
        # Clamp logits to prevent overflow in softmax
        action_logits = torch.clamp(action_logits, -10.0, 10.0)
        action_probs = F.softmax(action_logits, dim=-1)

        # Critic
        critic = F.relu(self.critic_fc(x))
        state_value = self.critic_out(critic)

        return action_probs, state_value


# ==================== TRAFFIC ENVIRONMENT ====================

class TrafficEnvironment:
    """SUMO Traffic Environment with emergency vehicle priority and robust error handling"""

    def __init__(self, config):
        self.config = config
        self.logger = logging.getLogger("TrafficRL.Environment")
        self.intersections = config.INTERSECTIONS
        self.current_step = 0
        self.episode_reward = 0

        # State tracking
        self.lane_queues = defaultdict(int)
        self.lane_waiting_times = defaultdict(float)
        self.lane_speeds = defaultdict(float)
        self.lane_occupancy = defaultdict(float)

        # Traffic signal state
        self.current_phases = {}
        self.phase_durations = {}
        self.time_in_phase = {}
        self.pending_phase_changes = {}  # Track pending phase changes after yellow

        # Emergency vehicles
        self.emergency_vehicles = set()

        # Neighbor mapping
        self.neighbors = self._build_neighbor_map()

        # Performance metrics
        self.metrics = {
            'total_waiting_time': 0,
            'total_throughput': 0,
            'emergency_delays': 0,
            'avg_speed': 0,
            'congestion_level': 0
        }

        self.logger.info(f"Initialized environment with {len(self.intersections)} intersections")
        
    def _build_neighbor_map(self):
        """Build neighbor relationships for intersections"""
        neighbors = {}
        for i in range(3):
            for j in range(3):
                node = f"n{i}{j}"
                neighbors[node] = []
                # Add adjacent intersections
                if i > 0: neighbors[node].append(f"n{i-1}{j}")
                if i < 2: neighbors[node].append(f"n{i+1}{j}")
                if j > 0: neighbors[node].append(f"n{i}{j-1}")
                if j < 2: neighbors[node].append(f"n{i}{j+1}")
        return neighbors
    
    def start_simulation(self):
        """Start SUMO simulation with error handling"""
        try:
            sumo_cmd = self.config.get_sumo_cmd()
            self.logger.info(f"Starting SUMO with command: {' '.join(sumo_cmd)}")

            traci.start(sumo_cmd)
            self.logger.info("SUMO simulation started successfully")

            # Initialize traffic signals
            for node in self.intersections:
                try:
                    # Verify the traffic light exists
                    tls_list = traci.trafficlight.getIDList()
                    if node not in tls_list:
                        self.logger.warning(f"Traffic light {node} not found in simulation")
                        continue

                    self.current_phases[node] = 0
                    self.phase_durations[node] = self.config.MIN_PHASE_DURATION
                    self.time_in_phase[node] = 0
                    self.logger.debug(f"Initialized traffic light {node}")
                except traci.exceptions.TraCIException as e:
                    self.logger.error(f"Failed to initialize traffic light {node}: {e}")

        except Exception as e:
            self.logger.error(f"Failed to start SUMO simulation: {e}")
            raise
            
    def reset(self):
        """Reset environment with error handling"""
        try:
            if traci.isLoaded():
                traci.close()
                self.logger.debug("Closed previous SUMO instance")
        except Exception as e:
            self.logger.warning(f"Error closing SUMO: {e}")

        self.start_simulation()
        self.current_step = 0
        self.episode_reward = 0
        self.emergency_vehicles.clear()

        # Reset metrics
        for key in self.metrics:
            self.metrics[key] = 0

        self.logger.info("Environment reset complete")
        return self.get_state()
    
    def get_state(self):
        """Get comprehensive state representation with error handling"""
        state = {}

        for node in self.intersections:
            node_state = []

            # Get incoming lanes for this intersection
            try:
                incoming_lanes = traci.trafficlight.getControlledLanes(node)
                unique_lanes = list(set(incoming_lanes))[:8]  # Max 8 incoming lanes
            except traci.exceptions.TraCIException as e:
                self.logger.warning(f"Failed to get controlled lanes for {node}: {e}")
                unique_lanes = []
            except Exception as e:
                self.logger.error(f"Unexpected error getting lanes for {node}: {e}")
                unique_lanes = []

            if not unique_lanes:
                # Return zero state if no lanes
                state[node] = np.zeros(75, dtype=np.float32)
                self.logger.debug(f"No lanes found for {node}, using zero state")
                continue
            
            # 1. Queue lengths (normalized)
            queues = [traci.lane.getLastStepHaltingNumber(lane) / 20.0 for lane in unique_lanes]
            node_state.extend(queues + [0] * (8 - len(queues)))
            
            # 2. Waiting times (normalized)
            waiting_times = [traci.lane.getWaitingTime(lane) / 100.0 for lane in unique_lanes]
            node_state.extend(waiting_times + [0] * (8 - len(waiting_times)))
            
            # 3. Average speeds (normalized)
            speeds = [traci.lane.getLastStepMeanSpeed(lane) / 13.9 for lane in unique_lanes]
            node_state.extend(speeds + [0] * (8 - len(speeds)))
            
            # 4. Occupancy (density)
            occupancy = [traci.lane.getLastStepOccupancy(lane) / 100.0 for lane in unique_lanes]
            node_state.extend(occupancy + [0] * (8 - len(occupancy)))
            
            # 5. Emergency vehicle presence
            emergency_present = [0] * 8
            for idx, lane in enumerate(unique_lanes):
                vehicles = traci.lane.getLastStepVehicleIDs(lane)
                for veh in vehicles:
                    try:
                        vtype = traci.vehicle.getTypeID(veh)
                        if vtype in ['ambulance', 'firetruck', 'police']:
                            emergency_present[idx] = 1
                            self.emergency_vehicles.add(veh)
                            break
                    except:
                        pass
            node_state.extend(emergency_present)
            
            # 6. Current phase and time in phase
            current_phase = self.current_phases[node] / 8.0  # Normalize
            time_in_phase = self.time_in_phase[node] / self.config.MAX_PHASE_DURATION
            node_state.extend([current_phase, time_in_phase])
            
            # 7. Pressure (difference between incoming and outgoing)
            incoming_vehicles = sum(traci.lane.getLastStepVehicleNumber(lane) for lane in unique_lanes)
            try:
                outgoing_lanes = traci.trafficlight.getControlledLinks(node)
                outgoing_vehicles = 0
                for link_list in outgoing_lanes:
                    for link in link_list:
                        if len(link) > 0:
                            out_lane = link[0]
                            try:
                                outgoing_vehicles += traci.lane.getLastStepVehicleNumber(out_lane)
                            except:
                                pass
            except:
                outgoing_vehicles = 0
                
            pressure = (incoming_vehicles - outgoing_vehicles) / 20.0
            node_state.append(pressure)
            
            # 8. Neighbor information (average queue and waiting time)
            neighbor_queues = []
            neighbor_waiting = []
            for neighbor in self.neighbors[node]:
                try:
                    neighbor_lanes = traci.trafficlight.getControlledLanes(neighbor)
                    neighbor_unique = list(set(neighbor_lanes))
                    if neighbor_unique:
                        avg_queue = np.mean([traci.lane.getLastStepHaltingNumber(l) for l in neighbor_unique])
                        avg_wait = np.mean([traci.lane.getWaitingTime(l) for l in neighbor_unique])
                        neighbor_queues.append(avg_queue / 20.0)
                        neighbor_waiting.append(avg_wait / 100.0)
                except:
                    pass
            
            # Pad to 4 neighbors max
            neighbor_queues.extend([0] * (4 - len(neighbor_queues)))
            neighbor_waiting.extend([0] * (4 - len(neighbor_waiting)))
            node_state.extend(neighbor_queues[:4])
            node_state.extend(neighbor_waiting[:4])
            
            state[node] = np.array(node_state, dtype=np.float32)
        
        return state
    
    def calculate_reward(self, node):
        """Calculate reward with emergency vehicle priority"""
        try:
            incoming_lanes = traci.trafficlight.getControlledLanes(node)
            unique_lanes = list(set(incoming_lanes))
        except:
            return 0
        
        reward = 0
        
        # 1. Waiting time penalty (weighted by vehicle priority)
        total_waiting = 0
        emergency_waiting = 0
        
        for lane in unique_lanes:
            try:
                vehicles = traci.lane.getLastStepVehicleIDs(lane)
                for veh in vehicles:
                    try:
                        vtype = traci.vehicle.getTypeID(veh)
                        waiting_time = traci.vehicle.getWaitingTime(veh)
                        priority = self.config.PRIORITY_WEIGHTS.get(vtype, 1)
                        
                        if vtype in ['ambulance', 'firetruck', 'police']:
                            emergency_waiting += waiting_time * priority
                        else:
                            total_waiting += waiting_time * priority
                    except:
                        pass
            except:
                pass
        
        # Heavy penalty for emergency vehicle waiting
        reward -= emergency_waiting * 5.0
        reward -= total_waiting * 0.1
        
        # 2. Throughput reward
        try:
            arrived = traci.simulation.getArrivedNumber()
            reward += arrived * 0.5
        except:
            pass
        
        # 3. Speed reward
        try:
            avg_speed = np.mean([traci.lane.getLastStepMeanSpeed(lane) for lane in unique_lanes])
            reward += avg_speed * 0.2
        except:
            pass
        
        # 4. Queue penalty
        try:
            total_queue = sum(traci.lane.getLastStepHaltingNumber(lane) for lane in unique_lanes)
            reward -= total_queue * 0.3
        except:
            pass
        
        # 5. Pressure penalty
        try:
            incoming_vehicles = sum(traci.lane.getLastStepVehicleNumber(lane) for lane in unique_lanes)
            outgoing_lanes = traci.trafficlight.getControlledLinks(node)
            outgoing_vehicles = 0
            for link_list in outgoing_lanes:
                for link in link_list:
                    if len(link) > 0:
                        try:
                            outgoing_vehicles += traci.lane.getLastStepVehicleNumber(link[0])
                        except:
                            pass
            pressure = abs(incoming_vehicles - outgoing_vehicles)
            reward -= pressure * 0.2
        except:
            pass
        
        # 6. Phase change penalty (to avoid frequent switching)
        if self.time_in_phase[node] < 3:
            reward -= 2.0
        
        return reward
    
    def check_congestion(self):
        """Check if congestion exceeds threshold"""
        total_lanes = 0
        congested_lanes = 0
        
        for node in self.intersections:
            try:
                lanes = traci.trafficlight.getControlledLanes(node)
                unique_lanes = list(set(lanes))
                
                for lane in unique_lanes:
                    try:
                        total_lanes += 1
                        occupancy = traci.lane.getLastStepOccupancy(lane)
                        if occupancy > 70:  # 70% occupancy
                            congested_lanes += 1
                    except:
                        pass
            except:
                pass
        
        congestion_ratio = congested_lanes / total_lanes if total_lanes > 0 else 0
        self.metrics['congestion_level'] = congestion_ratio
        
        return congestion_ratio > self.config.CONGESTION_THRESHOLD
    
    def apply_action(self, node, action):
        """Apply action: action = (action_type, phase_idx, duration) with error handling

        SUMO Phase Structure (from grid3x3.net.xml):
        - Phase 0: Green direction 1
        - Phase 1: Yellow transition
        - Phase 2: Green direction 2
        - Phase 3: Yellow transition
        - Phase 4: Green direction 3
        - Phase 5: Yellow transition
        - Phase 6: Green direction 4
        - Phase 7: Yellow transition

        Agent's phase_idx (0-3) maps to SUMO green phases (0, 2, 4, 6)
        """
        action_type, phase_idx, duration = action

        try:
            current_phase = traci.trafficlight.getPhase(node)

            # Map agent's phase_idx (0-3) to SUMO green phase (0, 2, 4, 6)
            # Agent thinks: 0, 1, 2, 3 -> SUMO has: 0, 2, 4, 6
            sumo_green_phase = phase_idx * 2 if phase_idx is not None else None

            if action_type == 'keep':
                # Keep current phase - just increment timer
                self.time_in_phase[node] += 1

                # If we're in a yellow phase, let it complete naturally
                if current_phase % 2 == 1:  # Yellow phase (1, 3, 5, 7)
                    self.logger.debug(f"{node}: In yellow phase {current_phase}, letting it complete")
                    return

                # Check if we've exceeded max duration for green phase
                if self.time_in_phase[node] >= self.config.MAX_PHASE_DURATION:
                    self.logger.debug(f"{node}: Keeping phase but resetting timer (max duration reached)")
                    self.time_in_phase[node] = 0

            elif action_type == 'switch':
                # Check if we're violating minimum phase duration
                if self.time_in_phase[node] < self.config.MIN_PHASE_DURATION:
                    self.logger.debug(f"{node}: Cannot switch yet (min duration not met: {self.time_in_phase[node]}/{self.config.MIN_PHASE_DURATION})")
                    self.time_in_phase[node] += 1
                    return

                # If we're currently in a yellow phase, wait for it to complete
                if current_phase % 2 == 1:  # Yellow phase
                    self.logger.debug(f"{node}: In yellow phase {current_phase}, waiting to complete")
                    return

                # Check if phase change is needed
                if sumo_green_phase != current_phase:
                    # Need to change phase - first go to yellow
                    yellow_phase = current_phase + 1  # Green phase 0->1, 2->3, 4->5, 6->7

                    self.logger.info(f"{node}: Switching from green phase {current_phase} to yellow {yellow_phase}, then to green phase {sumo_green_phase}")

                    # Set yellow phase
                    traci.trafficlight.setPhase(node, yellow_phase)
                    traci.trafficlight.setPhaseDuration(node, self.config.YELLOW_PHASE_DURATION)

                    # After yellow completes, SUMO will automatically go to next phase
                    # We need to set the target green phase after yellow
                    # Schedule the green phase change
                    self.pending_phase_changes[node] = (sumo_green_phase, duration)

                    self.current_phases[node] = phase_idx
                    self.time_in_phase[node] = 0
                else:
                    # Same green phase, just update duration
                    self.logger.debug(f"{node}: Staying in green phase {current_phase}, updating duration to {duration}s")
                    traci.trafficlight.setPhaseDuration(node, duration)
                    self.phase_durations[node] = duration
                    self.time_in_phase[node] = 0
            else:
                self.logger.warning(f"{node}: Unknown action type '{action_type}'")

        except traci.exceptions.TraCIException as e:
            self.logger.error(f"TraCI error applying action to {node}: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error applying action to {node}: {e}")
    
    def step(self, actions):
        """Execute one step in environment with error handling"""
        # Apply actions
        for node in self.intersections:
            if node in actions:
                self.apply_action(node, actions[node])

        # Simulation step
        try:
            traci.simulationStep()
        except traci.exceptions.TraCIException as e:
            self.logger.error(f"TraCI error during simulation step: {e}")
            return self.get_state(), {}, True, self.metrics
        except Exception as e:
            self.logger.error(f"Unexpected error during simulation step: {e}")
            return self.get_state(), {}, True, self.metrics

        # Handle pending phase changes (after yellow phases complete)
        try:
            for node in list(self.pending_phase_changes.keys()):
                current_phase = traci.trafficlight.getPhase(node)

                # If we're back in a green phase (even numbered), apply the pending change
                if current_phase % 2 == 0:
                    target_green_phase, duration = self.pending_phase_changes[node]

                    # Set the target green phase
                    traci.trafficlight.setPhase(node, target_green_phase)
                    traci.trafficlight.setPhaseDuration(node, duration)

                    self.logger.info(f"{node}: Applied pending phase change to green phase {target_green_phase} with duration {duration}s")

                    # Clear the pending change
                    del self.pending_phase_changes[node]
        except traci.exceptions.TraCIException as e:
            self.logger.error(f"TraCI error handling pending phase changes: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error handling pending phase changes: {e}")

        self.current_step += 1

        # Get new state
        next_state = self.get_state()

        # Calculate rewards
        rewards = {}
        for node in self.intersections:
            rewards[node] = self.calculate_reward(node)

        # Check termination
        done = False
        if self.current_step >= self.config.EPISODE_DURATION:
            done = True
            self.logger.info(f"Episode ended: reached max duration ({self.config.EPISODE_DURATION}s)")
        elif self.check_congestion():
            done = True
            self.logger.warning(f"Episode ended: congestion threshold exceeded")
            # Add penalty for causing congestion
            for node in self.intersections:
                rewards[node] -= 50

        # Update metrics
        try:
            self.metrics['total_waiting_time'] += sum(
                traci.vehicle.getWaitingTime(v) for v in traci.vehicle.getIDList()
            )
            self.metrics['total_throughput'] = traci.simulation.getArrivedNumber()
        except traci.exceptions.TraCIException as e:
            self.logger.warning(f"Error updating metrics: {e}")
        except Exception as e:
            self.logger.error(f"Unexpected error updating metrics: {e}")

        return next_state, rewards, done, self.metrics
    
    def close(self):
        """Close simulation with error handling"""
        try:
            if traci.isLoaded():
                traci.close()
                self.logger.info("SUMO simulation closed")
        except Exception as e:
            self.logger.error(f"Error closing SUMO: {e}")


# ==================== RL AGENTS ====================

class DQNAgent:
    """Deep Q-Network Agent"""
    
    def __init__(self, state_size, action_size, config, device='cuda'):
        self.state_size = state_size
        self.action_size = action_size
        self.config = config
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        
        # Networks
        self.policy_net = DQNNetwork(state_size, action_size).to(self.device)
        self.target_net = DQNNetwork(state_size, action_size).to(self.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()
        
        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=config.LEARNING_RATE)
        self.memory = deque(maxlen=config.MEMORY_SIZE)
        
        self.epsilon = config.EPSILON_START
        self.steps = 0
        
    def select_action(self, state, inference=False):
        """Select action using epsilon-greedy with keep/switch option

        Note: SUMO has 4 green phases (0,2,4,6), so phase_idx is 0-3
        """
        num_phases = 4  # Only 4 green phases

        if not inference and random.random() < self.epsilon:
            # Random action
            if self.config.ALLOW_PHASE_KEEP and random.random() < 0.3:
                # 30% chance to keep current phase
                return ('keep', None, None)
            else:
                # Switch to new phase (0-3 for 4 green phases)
                phase_idx = random.randint(0, num_phases - 1)
                duration = random.randint(self.config.MIN_PHASE_DURATION,
                                         self.config.MAX_PHASE_DURATION)
                return ('switch', phase_idx, duration)

        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            action_idx = q_values.argmax().item()

            # Decode action
            if self.config.ALLOW_PHASE_KEEP:
                if action_idx == 0:
                    # Keep current phase
                    return ('keep', None, None)
                else:
                    # Switch phase
                    action_idx -= 1  # Adjust for keep action
                    num_durations = (self.config.MAX_PHASE_DURATION - self.config.MIN_PHASE_DURATION) // 2 + 1
                    phase_idx = action_idx % num_phases  # 4 phases instead of 8
                    duration_idx = action_idx // num_phases
                    duration = self.config.MIN_PHASE_DURATION + duration_idx * 2
                    duration = min(duration, self.config.MAX_PHASE_DURATION)
                    return ('switch', phase_idx, duration)
            else:
                # Original behavior
                phase_idx = action_idx % num_phases  # 4 phases instead of 8
                duration_idx = action_idx // num_phases
                duration = self.config.MIN_PHASE_DURATION + duration_idx * 2
                duration = min(duration, self.config.MAX_PHASE_DURATION)
                return ('switch', phase_idx, duration)
    
    def store_transition(self, state, action, reward, next_state, done):
        """Store transition in memory"""
        self.memory.append((state, action, reward, next_state, done))
    
    def train(self):
        """Train the network"""
        if len(self.memory) < self.config.BATCH_SIZE:
            return None
        
        # Sample batch
        batch = random.sample(self.memory, self.config.BATCH_SIZE)
        states, actions, rewards, next_states, dones = zip(*batch)
        
        states = torch.FloatTensor(np.array(states)).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)
        
        # Current Q values
        current_q = self.policy_net(states).gather(1, actions.unsqueeze(1))
        
        # Target Q values
        with torch.no_grad():
            next_q = self.target_net(next_states).max(1)[0]
            target_q = rewards + (1 - dones) * self.config.GAMMA * next_q
        
        # Loss
        loss = F.smooth_l1_loss(current_q.squeeze(), target_q)
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.policy_net.parameters(), 1.0)
        self.optimizer.step()
        
        # Update epsilon
        self.epsilon = max(self.config.EPSILON_END, 
                          self.epsilon * self.config.EPSILON_DECAY)
        
        self.steps += 1
        
        # Update target network
        if self.steps % self.config.TARGET_UPDATE == 0:
            self.target_net.load_state_dict(self.policy_net.state_dict())
        
        return loss.item()
    
    def save(self, path):
        """Save model"""
        torch.save({
            'policy_net': self.policy_net.state_dict(),
            'target_net': self.target_net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'steps': self.steps
        }, path)
    
    def load(self, path):
        """Load model"""
        checkpoint = torch.load(path, map_location=self.device)
        self.policy_net.load_state_dict(checkpoint['policy_net'])
        self.target_net.load_state_dict(checkpoint['target_net'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])
        self.epsilon = checkpoint['epsilon']
        self.steps = checkpoint['steps']


class PPOAgent:
    """Proximal Policy Optimization Agent"""
    
    def __init__(self, state_size, action_size, config, device='cuda'):
        self.state_size = state_size
        self.action_size = action_size
        self.config = config
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        
        self.actor_critic = ActorCritic(state_size, action_size).to(self.device)
        self.optimizer = optim.Adam(self.actor_critic.parameters(), lr=config.LEARNING_RATE)
        
        self.memory = []
        
    def select_action(self, state, inference=False):
        """Select action using policy with keep/switch option

        Note: SUMO has 4 green phases (0,2,4,6), so phase_idx is 0-3
        """
        num_phases = 4  # Only 4 green phases

        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)

        with torch.no_grad():
            action_probs, _ = self.actor_critic(state_tensor)

        if inference:
            action_idx = action_probs.argmax().item()
        else:
            dist = Categorical(action_probs)
            action_idx = dist.sample().item()

        # Decode action
        if self.config.ALLOW_PHASE_KEEP:
            if action_idx == 0:
                # Keep current phase
                action = ('keep', None, None)
            else:
                # Switch phase
                action_idx -= 1
                num_durations = (self.config.MAX_PHASE_DURATION - self.config.MIN_PHASE_DURATION) // 2 + 1
                phase_idx = action_idx % num_phases  # 4 phases instead of 8
                duration_idx = action_idx // num_phases
                duration = self.config.MIN_PHASE_DURATION + duration_idx * 2
                duration = min(duration, self.config.MAX_PHASE_DURATION)
                action = ('switch', phase_idx, duration)
        else:
            phase_idx = action_idx % num_phases  # 4 phases instead of 8
            duration_idx = action_idx // num_phases
            duration = self.config.MIN_PHASE_DURATION + duration_idx * 2
            duration = min(duration, self.config.MAX_PHASE_DURATION)
            action = ('switch', phase_idx, duration)

        log_prob = torch.log(action_probs[0, action_idx] + 1e-10)

        return action, log_prob

    def store_transition(self, state, action, log_prob, reward, next_state, done):
        """Store transition - encode action to integer"""
        num_phases = 4  # Only 4 green phases

        # Encode action tuple to integer
        action_type, phase_idx, duration = action

        if self.config.ALLOW_PHASE_KEEP:
            if action_type == 'keep':
                action_idx = 0
            else:
                num_durations = (self.config.MAX_PHASE_DURATION - self.config.MIN_PHASE_DURATION) // 2 + 1
                duration_idx = (duration - self.config.MIN_PHASE_DURATION) // 2
                action_idx = 1 + phase_idx + duration_idx * num_phases  # 4 phases instead of 8
        else:
            duration_idx = (duration - self.config.MIN_PHASE_DURATION) // 2
            action_idx = phase_idx + duration_idx * num_phases  # 4 phases instead of 8

        self.memory.append((state, action_idx, log_prob, reward, next_state, done))
    
    def train(self):
        """Train using PPO with NaN protection"""
        # Require at least 10 samples for stable training
        if len(self.memory) < 10:
            return None

        states, actions, old_log_probs, rewards, next_states, dones = zip(*self.memory)

        states = torch.FloatTensor(np.array(states)).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        old_log_probs = torch.stack(old_log_probs).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)

        # Normalize rewards to prevent gradient explosion
        if rewards.std() > 1e-6:
            rewards = (rewards - rewards.mean()) / (rewards.std() + 1e-8)

        # Calculate advantages
        with torch.no_grad():
            _, values = self.actor_critic(states)
            _, next_values = self.actor_critic(next_states)

            returns = rewards + (1 - dones) * self.config.GAMMA * next_values.squeeze()
            advantages = returns - values.squeeze()

            # Normalize advantages only if we have enough variance
            if advantages.std() > 1e-6:
                advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # PPO update
        total_loss = 0
        for _ in range(self.config.PPO_EPOCHS):
            action_probs, values = self.actor_critic(states)

            # Check for NaN in action probabilities
            if torch.isnan(action_probs).any():
                print("Warning: NaN detected in action_probs, skipping update")
                self.memory.clear()
                return None

            dist = Categorical(action_probs)

            new_log_probs = dist.log_prob(actions)
            entropy = dist.entropy().mean()

            ratio = torch.exp(new_log_probs - old_log_probs)
            ratio = torch.clamp(ratio, 0.0, 10.0)  # Prevent extreme ratios

            surr1 = ratio * advantages
            surr2 = torch.clamp(ratio, 1 - self.config.PPO_CLIP,
                               1 + self.config.PPO_CLIP) * advantages

            actor_loss = -torch.min(surr1, surr2).mean()
            critic_loss = F.mse_loss(values.squeeze(), returns)

            loss = actor_loss + 0.5 * critic_loss - self.config.PPO_ENTROPY_COEF * entropy

            # Check for NaN in loss
            if torch.isnan(loss):
                print("Warning: NaN detected in loss, skipping update")
                self.memory.clear()
                return None

            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.actor_critic.parameters(), 0.5)
            self.optimizer.step()

            total_loss += loss.item()

        self.memory.clear()
        return total_loss / self.config.PPO_EPOCHS
    
    def save(self, path):
        """Save model"""
        torch.save({
            'actor_critic': self.actor_critic.state_dict(),
            'optimizer': self.optimizer.state_dict()
        }, path)
    
    def load(self, path):
        """Load model"""
        checkpoint = torch.load(path, map_location=self.device)
        self.actor_critic.load_state_dict(checkpoint['actor_critic'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])


class A3CAgent:
    """Asynchronous Advantage Actor-Critic Agent (simplified single-thread version)"""
    
    def __init__(self, state_size, action_size, config, device='cuda'):
        self.state_size = state_size
        self.action_size = action_size
        self.config = config
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        
        self.actor_critic = ActorCritic(state_size, action_size).to(self.device)
        self.optimizer = optim.Adam(self.actor_critic.parameters(), lr=config.LEARNING_RATE)
        
        self.memory = []
        
    def select_action(self, state, inference=False):
        """Select action with keep/switch option

        Note: SUMO has 4 green phases (0,2,4,6), so phase_idx is 0-3
        """
        num_phases = 4  # Only 4 green phases

        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)

        action_probs, value = self.actor_critic(state_tensor)

        if inference:
            action_idx = action_probs.argmax().item()
        else:
            dist = Categorical(action_probs)
            action_idx = dist.sample().item()

        # Decode action
        if self.config.ALLOW_PHASE_KEEP:
            if action_idx == 0:
                # Keep current phase
                action = ('keep', None, None)
            else:
                # Switch phase
                action_idx -= 1
                num_durations = (self.config.MAX_PHASE_DURATION - self.config.MIN_PHASE_DURATION) // 2 + 1
                phase_idx = action_idx % num_phases  # 4 phases instead of 8
                duration_idx = action_idx // num_phases
                duration = self.config.MIN_PHASE_DURATION + duration_idx * 2
                duration = min(duration, self.config.MAX_PHASE_DURATION)
                action = ('switch', phase_idx, duration)
        else:
            phase_idx = action_idx % num_phases  # 4 phases instead of 8
            duration_idx = action_idx // num_phases
            duration = self.config.MIN_PHASE_DURATION + duration_idx * 2
            duration = min(duration, self.config.MAX_PHASE_DURATION)
            action = ('switch', phase_idx, duration)

        log_prob = torch.log(action_probs[0, action_idx] + 1e-10)

        return action, log_prob, value

    def store_transition(self, state, action, log_prob, value, reward, next_state, done):
        """Store transition - encode action to integer"""
        num_phases = 4  # Only 4 green phases

        # Encode action tuple to integer
        action_type, phase_idx, duration = action

        if self.config.ALLOW_PHASE_KEEP:
            if action_type == 'keep':
                action_idx = 0
            else:
                num_durations = (self.config.MAX_PHASE_DURATION - self.config.MIN_PHASE_DURATION) // 2 + 1
                duration_idx = (duration - self.config.MIN_PHASE_DURATION) // 2
                action_idx = 1 + phase_idx + duration_idx * num_phases  # 4 phases instead of 8
        else:
            duration_idx = (duration - self.config.MIN_PHASE_DURATION) // 2
            action_idx = phase_idx + duration_idx * num_phases  # 4 phases instead of 8

        self.memory.append((state, action_idx, log_prob, value, reward, next_state, done))
    
    def train(self):
        """Train using A3C"""
        if len(self.memory) == 0:
            return None
        
        states, actions, old_log_probs, old_values, rewards, next_states, dones = zip(*self.memory)
        
        states = torch.FloatTensor(np.array(states)).to(self.device)
        old_log_probs = torch.stack(old_log_probs).to(self.device)
        old_values = torch.stack([v.squeeze() for v in old_values]).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)
        
        # Calculate returns
        returns = []
        R = 0
        for r, d in zip(reversed(rewards), reversed(dones)):
            R = r + self.config.GAMMA * R * (1 - d)
            returns.insert(0, R)
        returns = torch.FloatTensor(returns).to(self.device)
        
        # Calculate advantages
        advantages = returns - old_values
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        
        # Loss
        actor_loss = -(old_log_probs * advantages.detach()).mean()
        critic_loss = F.mse_loss(old_values, returns)
        
        loss = actor_loss + 0.5 * critic_loss
        
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.actor_critic.parameters(), 40)
        self.optimizer.step()
        
        self.memory.clear()
        return loss.item()
    
    def save(self, path):
        """Save model"""
        torch.save({
            'actor_critic': self.actor_critic.state_dict(),
            'optimizer': self.optimizer.state_dict()
        }, path)
    
    def load(self, path):
        """Load model"""
        checkpoint = torch.load(path, map_location=self.device)
        self.actor_critic.load_state_dict(checkpoint['actor_critic'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])


# ==================== MULTI-AGENT COORDINATOR ====================

class MultiAgentCoordinator:
    """Coordinates multiple intersection agents with neighbor awareness"""
    
    def __init__(self, agent_class, config, env):
        self.config = config
        self.env = env
        self.agents = {}
        self.logger = logging.getLogger("TrafficRL.Coordinator")

        # Start simulation to get actual state size
        self.logger.info("Starting simulation to determine state size...")
        env.start_simulation()
        sample_state = env.get_state()
        env.close()

        # Calculate state size from actual state
        state_size = len(list(sample_state.values())[0])
        self.logger.info(f"Detected state size: {state_size}")

        # Action size calculation:
        # If ALLOW_PHASE_KEEP: action = (keep/switch, phase_idx, duration)
        # - 1 bit for keep (0) or switch (1)
        # - 4 possible GREEN phases (SUMO has phases 0,2,4,6 as green, 1,3,5,7 as yellow)
        # - Multiple duration options
        num_phases = 4  # Only 4 green phases in SUMO traffic light program
        num_durations = (config.MAX_PHASE_DURATION - config.MIN_PHASE_DURATION) // 2 + 1

        if config.ALLOW_PHASE_KEEP:
            # Action space: 1 (keep) + 4 phases * num_durations (switch options)
            action_size = 1 + (num_phases * num_durations)
        else:
            # Original: 4 phases * num_durations
            action_size = num_phases * num_durations

        # Create agents for each intersection
        for node in env.intersections:
            self.agents[node] = agent_class(state_size, action_size, config)

        self.logger.info(f"Created {len(self.agents)} agents with state_size={state_size}, action_size={action_size}")
        self.logger.info(f"Action space: keep_phase={config.ALLOW_PHASE_KEEP}, num_phases={num_phases}, num_durations={num_durations}")
    
    def select_actions(self, states, inference=False):
        """Select actions for all agents"""
        actions = {}
        extras = {}  # Store log_probs, values for PPO/A3C
        
        for node in self.env.intersections:
            state = states[node]
            
            # Add neighbor information to state (already included in get_state)
            result = self.agents[node].select_action(state, inference)
            
            if isinstance(result, tuple):
                if len(result) == 2:
                    actions[node], extras[node] = result
                elif len(result) == 3:
                    actions[node], log_prob, value = result
                    extras[node] = (log_prob, value)
            else:
                actions[node] = result
        
        return actions, extras
    
    def train_all(self, transitions):
        """Train all agents"""
        losses = {}
        
        for node in self.env.intersections:
            if node in transitions:
                state, action, reward, next_state, done, extras = transitions[node]
                
                # Store transition
                if hasattr(self.agents[node], 'store_transition'):
                    if 'log_prob' in extras and 'value' in extras:
                        # A3C
                        self.agents[node].store_transition(
                            state, action, extras['log_prob'], 
                            extras['value'], reward, next_state, done
                        )
                    elif 'log_prob' in extras:
                        # PPO
                        self.agents[node].store_transition(
                            state, action, extras['log_prob'],
                            reward, next_state, done
                        )
                    else:
                        # DQN
                        # Encode action to single integer
                        action_type, phase_idx, duration = action

                        if self.config.ALLOW_PHASE_KEEP:
                            if action_type == 'keep':
                                action_idx = 0
                            else:
                                num_durations = (self.config.MAX_PHASE_DURATION - self.config.MIN_PHASE_DURATION) // 2 + 1
                                duration_idx = (duration - self.config.MIN_PHASE_DURATION) // 2
                                action_idx = 1 + phase_idx + duration_idx * 8
                        else:
                            duration_idx = (duration - self.config.MIN_PHASE_DURATION) // 2
                            action_idx = phase_idx + duration_idx * 8

                        self.agents[node].store_transition(
                            state, action_idx, reward, next_state, done
                        )
                
                # Train
                loss = self.agents[node].train()
                if loss is not None:
                    losses[node] = loss
        
        return losses
    
    def save_all(self, directory):
        """Save all agents"""
        os.makedirs(directory, exist_ok=True)
        for node, agent in self.agents.items():
            agent.save(os.path.join(directory, f"agent_{node}.pth"))
        print(f"✅ Saved all agents to {directory}")
    
    def load_all(self, directory):
        """Load all agents"""
        for node, agent in self.agents.items():
            path = os.path.join(directory, f"agent_{node}.pth")
            if os.path.exists(path):
                agent.load(path)
        print(f"✅ Loaded all agents from {directory}")


# ==================== TRAINING LOOP ====================

class Trainer:
    """Training manager with TensorBoard support and comprehensive logging"""

    def __init__(self, agent_class, config, save_dir=None):
        self.config = config
        self.logger = logging.getLogger("TrafficRL.Trainer")
        self.save_dir = save_dir or config.SAVE_DIR
        self.env = TrafficEnvironment(config)
        self.coordinator = MultiAgentCoordinator(agent_class, config, self.env)

        self.episode_rewards = []
        self.episode_metrics = []

        os.makedirs(self.save_dir, exist_ok=True)

        # TensorBoard writer
        self.writer = None
        if config.USE_TENSORBOARD:
            tb_dir = os.path.join(config.TENSORBOARD_DIR,
                                 datetime.now().strftime('%Y%m%d_%H%M%S'))
            self.writer = SummaryWriter(tb_dir)
            self.logger.info(f"TensorBoard logging to {tb_dir}")

        self.logger.info(f"Trainer initialized with save_dir={self.save_dir}")
    
    def train(self, num_episodes=None, save_interval=None):
        """Train agents with TensorBoard logging"""
        num_episodes = num_episodes or self.config.NUM_EPISODES
        save_interval = save_interval or self.config.SAVE_INTERVAL

        self.logger.info(f"Starting training for {num_episodes} episodes")
        self.logger.info(f"Save interval: {save_interval} episodes")

        for episode in range(num_episodes):
            try:
                states = self.env.reset()
                episode_reward = 0
                episode_losses = []
                step = 0

                while True:
                    # Select actions
                    actions, extras = self.coordinator.select_actions(states)

                    # Environment step
                    next_states, rewards, done, metrics = self.env.step(actions)

                    # Prepare transitions
                    transitions = {}
                    for node in self.env.intersections:
                        extra_info = {}
                        if node in extras:
                            if isinstance(extras[node], tuple) and len(extras[node]) == 2:
                                log_prob, value = extras[node]
                                extra_info = {'log_prob': log_prob, 'value': value}
                            elif isinstance(extras[node], torch.Tensor):
                                extra_info = {'log_prob': extras[node]}

                        transitions[node] = (
                            states[node], actions[node], rewards[node],
                            next_states[node], done, extra_info
                        )

                    # Train
                    losses = self.coordinator.train_all(transitions)
                    if losses:
                        episode_losses.append(np.mean(list(losses.values())))

                    episode_reward += sum(rewards.values())
                    states = next_states
                    step += 1

                    if done:
                        break

                # Episode summary
                self.episode_rewards.append(episode_reward)
                self.episode_metrics.append(metrics)

                avg_loss = np.mean(episode_losses) if episode_losses else 0

                # Log to console
                self.logger.info(
                    f"Episode {episode+1}/{num_episodes} | "
                    f"Steps: {step} | "
                    f"Reward: {episode_reward:.2f} | "
                    f"Loss: {avg_loss:.4f} | "
                    f"Congestion: {metrics['congestion_level']:.2%} | "
                    f"Throughput: {metrics['total_throughput']}"
                )

                # Log to TensorBoard
                if self.writer:
                    self.writer.add_scalar('Episode/Reward', episode_reward, episode)
                    self.writer.add_scalar('Episode/Loss', avg_loss, episode)
                    self.writer.add_scalar('Episode/Steps', step, episode)
                    self.writer.add_scalar('Metrics/Throughput', metrics['total_throughput'], episode)
                    self.writer.add_scalar('Metrics/WaitingTime', metrics['total_waiting_time'], episode)
                    self.writer.add_scalar('Metrics/Congestion', metrics['congestion_level'], episode)

                # Save periodically
                if (episode + 1) % save_interval == 0:
                    save_path = os.path.join(self.save_dir, f"episode_{episode+1}")
                    self.coordinator.save_all(save_path)
                    self.save_training_stats()
                    self.logger.info(f"Saved checkpoint to {save_path}")

            except Exception as e:
                self.logger.error(f"Error in episode {episode+1}: {e}", exc_info=True)
                continue

        self.env.close()
        if self.writer:
            self.writer.close()
        self.logger.info("Training complete!")
    
    def evaluate(self, num_episodes=5, model_path=None):
        """Evaluate trained agents"""
        if model_path:
            self.coordinator.load_all(model_path)
        
        print(f"\n{'='*60}")
        print(f"📊 Evaluating for {num_episodes} episodes")
        print(f"{'='*60}\n")
        
        eval_rewards = []
        eval_metrics = []
        
        for episode in range(num_episodes):
            states = self.env.reset()
            episode_reward = 0
            step = 0
            
            while True:
                # Select actions (inference mode)
                actions, _ = self.coordinator.select_actions(states, inference=True)
                
                # Environment step
                next_states, rewards, done, metrics = self.env.step(actions)
                
                episode_reward += sum(rewards.values())
                states = next_states
                step += 1
                
                if done:
                    break
            
            eval_rewards.append(episode_reward)
            eval_metrics.append(metrics)
            
            print(f"Eval Episode {episode+1}/{num_episodes} | "
                  f"Steps: {step} | "
                  f"Reward: {episode_reward:.2f} | "
                  f"Congestion: {metrics['congestion_level']:.2%} | "
                  f"Throughput: {metrics['total_throughput']} | "
                  f"Waiting Time: {metrics['total_waiting_time']:.2f}")
        
        self.env.close()
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"📈 Evaluation Summary:")
        print(f"Average Reward: {np.mean(eval_rewards):.2f} ± {np.std(eval_rewards):.2f}")
        print(f"Average Throughput: {np.mean([m['total_throughput'] for m in eval_metrics]):.2f}")
        print(f"Average Waiting Time: {np.mean([m['total_waiting_time'] for m in eval_metrics]):.2f}")
        print(f"Average Congestion: {np.mean([m['congestion_level'] for m in eval_metrics]):.2%}")
        print(f"{'='*60}\n")
        
        return eval_rewards, eval_metrics
    
    def save_training_stats(self):
        """Save training statistics"""
        stats = {
            'episode_rewards': self.episode_rewards,
            'episode_metrics': self.episode_metrics
        }
        
        with open(os.path.join(self.save_dir, 'training_stats.pkl'), 'wb') as f:
            pickle.dump(stats, f)
        
        # Save as JSON too for easy reading
        json_stats = {
            'episode_rewards': self.episode_rewards,
            'num_episodes': len(self.episode_rewards),
            'avg_reward': float(np.mean(self.episode_rewards[-10:])) if self.episode_rewards else 0
        }
        
        with open(os.path.join(self.save_dir, 'training_stats.json'), 'w') as f:
            json.dump(json_stats, f, indent=2)


# ==================== MAIN PROGRAM ====================

def parse_args():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description='Advanced RL Traffic Signal Control for SUMO',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    # General settings
    parser.add_argument('--config', type=str, default='config.yaml',
                       help='Path to configuration file')
    parser.add_argument('--mode', type=str, choices=['train', 'continue', 'eval'],
                       default='train', help='Execution mode')
    parser.add_argument('--algorithm', type=str, choices=['dqn', 'ppo', 'a3c'],
                       default='ppo', help='RL algorithm to use')

    # Training parameters
    parser.add_argument('--episodes', type=int, help='Number of training episodes')
    parser.add_argument('--save-interval', type=int, help='Save model every N episodes')
    parser.add_argument('--checkpoint', type=str, help='Path to checkpoint for continue/eval mode')

    # Hyperparameters
    parser.add_argument('--lr', type=float, help='Learning rate')
    parser.add_argument('--gamma', type=float, help='Discount factor')
    parser.add_argument('--batch-size', type=int, help='Batch size')

    # Environment settings
    parser.add_argument('--gui', action='store_true', help='Use SUMO GUI')
    parser.add_argument('--no-tensorboard', action='store_true', help='Disable TensorBoard')

    # Logging
    parser.add_argument('--log-level', type=str,
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Logging level')
    parser.add_argument('--save-dir', type=str, help='Directory to save models')

    return parser.parse_args()


def main():
    """Main function with argument parsing"""
    args = parse_args()

    # Load configuration
    config_overrides = {}
    if args.lr:
        config_overrides['learning_rate'] = args.lr
    if args.gamma:
        config_overrides['gamma'] = args.gamma
    if args.batch_size:
        config_overrides['batch_size'] = args.batch_size
    if args.gui:
        config_overrides['gui_mode'] = True
    if args.no_tensorboard:
        config_overrides['use_tensorboard'] = False

    config = Config(args.config, **config_overrides)

    # Setup logging
    log_level = args.log_level or config.LOG_LEVEL
    logger = setup_logging(log_level, config.LOG_FILE, config.CONSOLE_OUTPUT)

    logger.info("="*60)
    logger.info("🚦 Advanced RL Traffic Signal Control System 🚦")
    logger.info("SUMO 3x3 Grid with Emergency Vehicle Priority")
    logger.info("="*60)

    # Select algorithm
    agent_map = {
        'dqn': (DQNAgent, "DQN"),
        'ppo': (PPOAgent, "PPO"),
        'a3c': (A3CAgent, "A3C")
    }

    agent_class, agent_name = agent_map[args.algorithm]
    logger.info(f"Selected algorithm: {agent_name}")

    # Setup save directory
    if args.save_dir:
        save_dir = args.save_dir
    else:
        save_dir = os.path.join(
            config.SAVE_DIR,
            f"{agent_name.lower()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )

    # Create trainer
    trainer = Trainer(agent_class, config, save_dir=save_dir)

    try:
        if args.mode == 'train':
            # Train from scratch
            num_episodes = args.episodes or config.NUM_EPISODES
            save_interval = args.save_interval or config.SAVE_INTERVAL

            logger.info(f"Training from scratch for {num_episodes} episodes")
            trainer.train(num_episodes, save_interval)

            # Evaluate after training
            logger.info("Running post-training evaluation...")
            final_model = os.path.join(save_dir, f"episode_{num_episodes}")
            trainer.evaluate(num_episodes=config.EVAL_EPISODES, model_path=final_model)

        elif args.mode == 'continue':
            # Continue training from checkpoint
            if not args.checkpoint:
                logger.error("--checkpoint required for continue mode")
                return

            if not os.path.exists(args.checkpoint):
                logger.error(f"Checkpoint not found: {args.checkpoint}")
                return

            logger.info(f"Loading checkpoint from {args.checkpoint}")
            trainer.coordinator.load_all(args.checkpoint)

            num_episodes = args.episodes or 50
            save_interval = args.save_interval or config.SAVE_INTERVAL

            logger.info(f"Continuing training for {num_episodes} episodes")
            trainer.train(num_episodes, save_interval)

        elif args.mode == 'eval':
            # Evaluate trained model
            if not args.checkpoint:
                logger.error("--checkpoint required for eval mode")
                return

            if not os.path.exists(args.checkpoint):
                logger.error(f"Model not found: {args.checkpoint}")
                return

            num_eval = args.episodes or config.EVAL_EPISODES
            logger.info(f"Evaluating model for {num_eval} episodes")
            trainer.evaluate(num_episodes=num_eval, model_path=args.checkpoint)

    except KeyboardInterrupt:
        logger.info("Training interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
    finally:
        trainer.env.close()

    logger.info("Program finished")


if __name__ == "__main__":
    main()