import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

interface SUMOVehicle {
  id: string;
  position: { x: number; y: number };
  speed: number;
  type: string;
  angle: number;
  waiting_time: number;
}

interface SUMOTrafficLight {
  id: string;
  state: string;
  phase: number;
  next_switch: number;
  controlled_lanes: string[];
}

interface SUMOMetrics {
  current_time: number;
  vehicle_count: number;
  arrived_vehicles: number;
  departed_vehicles: number;
  waiting_time: number;
  avg_speed: number;
}

interface Alert {
  id: string;
  type: 'congestion' | 'emergency_vehicle' | 'accident';
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  timestamp: string;
  data?: any;
}

interface SUMOState {
  vehicles: SUMOVehicle[];
  traffic_lights: SUMOTrafficLight[];
  metrics: SUMOMetrics;
  step: number;
  alerts?: Alert[];
  all_alerts?: Alert[];
}

interface SUMOJunction {
  id: string;
  x: number;
  y: number;
  type: string;
}

interface SUMOEdge {
  id: string;
  from: string;
  to: string;
}

interface NetworkInfo {
  junctions: SUMOJunction[];
  edges: SUMOEdge[];
}

interface SimulationConfig {
  gui_mode?: boolean;
  step_length?: number;
  traffic_volume?: number;
  enable_rl?: boolean;
  rl_algorithm?: string;
  rl_model?: string | null;
  emergency_frequency?: number;
  max_steps?: number;
  simulation_speed?: number;
}

export function useSumoSimulation() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [state, setState] = useState<SUMOState | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch network info on mount
  useEffect(() => {
    fetchNetworkInfo();
  }, []);

  const fetchNetworkInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/network-info`);
      if (response.ok) {
        const data = await response.json();
        setNetworkInfo(data);
      }
    } catch (err) {
      console.error('Failed to fetch network info:', err);
    }
  };

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.vehicles && data.traffic_lights && data.metrics) {
            setState(data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      
      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 3000);
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to simulation server');
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // API calls
  const startSimulation = async (config?: SimulationConfig) => {
    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          config: config || {}
        })
      });
      
      if (response.ok) {
        setIsRunning(true);
        setIsPaused(false);
        setError(null);
        return true;
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to start simulation');
        return false;
      }
    } catch (err) {
      setError('Failed to connect to simulation server');
      return false;
    }
  };

  const pauseSimulation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      });
      
      if (response.ok) {
        setIsPaused(true);
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to pause simulation');
      return false;
    }
  };

  const resumeSimulation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      });
      
      if (response.ok) {
        setIsPaused(false);
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to resume simulation');
      return false;
    }
  };

  const stopSimulation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      
      if (response.ok) {
        setIsRunning(false);
        setIsPaused(false);
        setState(null);
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to stop simulation');
      return false;
    }
  };

  const stepSimulation = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'step' })
      });
      
      return response.ok;
    } catch (err) {
      setError('Failed to step simulation');
      return false;
    }
  };

  const controlTrafficLight = async (intersectionId: string, phase: number, duration?: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/traffic-light`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intersection_id: intersectionId,
          phase,
          duration
        })
      });

      return response.ok;
    } catch (err) {
      setError('Failed to control traffic light');
      return false;
    }
  };

  const setSimulationSpeed = async (speed: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_speed', speed })
      });

      return response.ok;
    } catch (err) {
      setError('Failed to set simulation speed');
      return false;
    }
  };

  return {
    isConnected,
    isRunning,
    isPaused,
    state,
    networkInfo,
    error,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
    stepSimulation,
    controlTrafficLight,
    setSimulationSpeed
  };
}

export type { Alert, SimulationConfig, SUMOState, SUMOVehicle, SUMOTrafficLight, NetworkInfo };

