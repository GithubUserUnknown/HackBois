#!/usr/bin/env python3
"""
RL Controller for SUMO Traffic Lights
Supports PPO, DQN, and Fixed-Time control strategies
"""

import os
import sys
import logging
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn

# SUMO imports
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")

import traci

logger = logging.getLogger(__name__)


# ==================== NEURAL NETWORKS ====================

class ActorCriticNetwork(nn.Module):
    """Actor-Critic network for PPO"""
    
    def __init__(self, obs_dim, action_dim, hidden_dim=128):
        super(ActorCriticNetwork, self).__init__()
        
        # Shared feature extractor
        self.shared = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU()
        )
        
        # Actor head (policy)
        self.actor = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
            nn.Softmax(dim=-1)
        )
        
        # Critic head (value function)
        self.critic = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        )
    
    def forward(self, obs):
        features = self.shared(obs)
        action_probs = self.actor(features)
        state_value = self.critic(features)
        return action_probs, state_value
    
    def get_action(self, obs):
        """Sample action from policy"""
        action_probs, _ = self.forward(obs)
        dist = torch.distributions.Categorical(action_probs)
        action = dist.sample()
        return action.item()


class DQNNetwork(nn.Module):
    """Deep Q-Network"""
    
    def __init__(self, state_size, action_size, hidden_size=256):
        super(DQNNetwork, self).__init__()
        self.fc1 = nn.Linear(state_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, action_size)
    
    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        return self.fc3(x)


# ==================== RL CONTROLLER ====================

class RLController:
    """
    RL-based traffic light controller
    Supports multiple algorithms: PPO, DQN, A3C, Fixed-Time, Actuated
    """

    def __init__(self, algorithm='ppo', model_path=None, device='cpu'):
        """
        Initialize RL controller

        Args:
            algorithm: 'ppo', 'dqn', 'a3c', 'fixed', or 'actuated'
            model_path: Path to trained model (optional)
            device: 'cpu' or 'cuda'
        """
        self.algorithm = algorithm.lower()
        self.device = torch.device(device)
        self.model = None
        self.traffic_lights = []
        self.phase_durations = {}  # Track phase durations
        self.last_switch_time = {}  # Track last switch time

        # Exploration parameters for untrained DQN
        self.epsilon = 0.3  # Exploration rate for untrained models
        self.is_trained = False  # Track if model is trained

        # Action space: 0 = keep current phase, 1-4 = switch to phase 0-3
        self.num_actions = 5

        # Observation dimensions (per intersection)
        # [queue_lengths(4), waiting_times(4), phase(1), time_since_switch(1), emergency_vehicle(1)]
        self.obs_dim = 11

        logger.info(f"Initializing RL Controller with algorithm: {self.algorithm}")

        # Load model if provided
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
            self.is_trained = True
        elif self.algorithm in ['ppo', 'dqn', 'a3c']:
            # Initialize untrained model
            self.initialize_model()
            self.is_trained = False
    
    def initialize_model(self):
        """Initialize neural network model"""
        if self.algorithm == 'ppo':
            self.model = ActorCriticNetwork(
                obs_dim=self.obs_dim,
                action_dim=self.num_actions,
                hidden_dim=128
            ).to(self.device)
            logger.info("Initialized untrained PPO model")

        elif self.algorithm == 'dqn':
            self.model = DQNNetwork(
                state_size=self.obs_dim,
                action_size=self.num_actions,
                hidden_size=256
            ).to(self.device)
            logger.info("Initialized untrained DQN model")

        elif self.algorithm == 'a3c':
            self.model = ActorCriticNetwork(
                obs_dim=self.obs_dim,
                action_dim=self.num_actions,
                hidden_dim=128
            ).to(self.device)
            logger.info("Initialized untrained A3C model")

        if self.model:
            self.model.eval()
    
    def load_model(self, model_path):
        """Load trained model from checkpoint"""
        try:
            checkpoint = torch.load(model_path, map_location=self.device)

            if self.algorithm == 'ppo':
                self.model = ActorCriticNetwork(
                    obs_dim=self.obs_dim,
                    action_dim=self.num_actions,
                    hidden_dim=128
                ).to(self.device)

                if 'policy_state_dict' in checkpoint:
                    self.model.load_state_dict(checkpoint['policy_state_dict'])
                else:
                    self.model.load_state_dict(checkpoint)

                logger.info(f"Loaded PPO model from {model_path}")

            elif self.algorithm == 'dqn':
                self.model = DQNNetwork(
                    state_size=self.obs_dim,
                    action_size=self.num_actions,
                    hidden_size=256
                ).to(self.device)

                if 'model_state_dict' in checkpoint:
                    self.model.load_state_dict(checkpoint['model_state_dict'])
                else:
                    self.model.load_state_dict(checkpoint)

                logger.info(f"Loaded DQN model from {model_path}")

            elif self.algorithm == 'a3c':
                self.model = ActorCriticNetwork(
                    obs_dim=self.obs_dim,
                    action_dim=self.num_actions,
                    hidden_dim=128
                ).to(self.device)

                if 'actor_critic' in checkpoint:
                    self.model.load_state_dict(checkpoint['actor_critic'])
                else:
                    self.model.load_state_dict(checkpoint)

                logger.info(f"Loaded A3C model from {model_path}")

            self.model.eval()

        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {e}")
            logger.info("Initializing untrained model instead")
            self.initialize_model()
    
    def initialize_traffic_lights(self):
        """Initialize traffic light tracking"""
        if not traci.isLoaded():
            return
        
        self.traffic_lights = traci.trafficlight.getIDList()
        current_time = traci.simulation.getTime()
        
        for tl_id in self.traffic_lights:
            self.phase_durations[tl_id] = 0
            self.last_switch_time[tl_id] = current_time
        
        logger.info(f"Initialized {len(self.traffic_lights)} traffic lights")
    
    def get_observation(self, tl_id: str) -> np.ndarray:
        """
        Get observation for a traffic light
        
        Returns:
            numpy array of shape (obs_dim,)
        """
        try:
            # Get controlled lanes
            lanes = traci.trafficlight.getControlledLanes(tl_id)
            unique_lanes = list(set(lanes))[:4]  # Max 4 approaches
            
            # Queue lengths (vehicles waiting)
            queue_lengths = []
            waiting_times = []
            has_emergency = 0
            
            for lane in unique_lanes:
                try:
                    # Get vehicles on this lane
                    vehicles = traci.lane.getLastStepVehicleIDs(lane)
                    queue = sum(1 for v in vehicles if traci.vehicle.getSpeed(v) < 0.1)
                    queue_lengths.append(queue)
                    
                    # Waiting time
                    wait = sum(traci.vehicle.getWaitingTime(v) for v in vehicles) / max(len(vehicles), 1)
                    waiting_times.append(wait)
                    
                    # Check for emergency vehicles
                    for v in vehicles:
                        vtype = traci.vehicle.getTypeID(v)
                        if vtype in ['ambulance', 'firetruck', 'police', 'emergency']:
                            has_emergency = 1
                            break
                
                except:
                    queue_lengths.append(0)
                    waiting_times.append(0)
            
            # Pad to 4 approaches
            while len(queue_lengths) < 4:
                queue_lengths.append(0)
                waiting_times.append(0)

            # Current phase (normalized by 8 phases total: 0-7)
            current_phase = traci.trafficlight.getPhase(tl_id) / 8.0

            # Time since last switch (normalized by 60 seconds)
            current_time = traci.simulation.getTime()
            time_since_switch = (current_time - self.last_switch_time.get(tl_id, current_time)) / 60.0

            # Combine observation
            obs = queue_lengths[:4] + waiting_times[:4] + [current_phase, time_since_switch, has_emergency]

            return np.array(obs, dtype=np.float32)
        
        except Exception as e:
            logger.error(f"Error getting observation for {tl_id}: {e}")
            return np.zeros(self.obs_dim, dtype=np.float32)
    
    def select_action(self, tl_id: str) -> int:
        """
        Select action for a traffic light

        Returns:
            action: 0 = keep, 1-4 = switch to phase 0-3
        """
        if self.algorithm == 'fixed':
            return self.fixed_time_action(tl_id)

        elif self.algorithm == 'actuated':
            return self.actuated_action(tl_id)

        elif self.algorithm in ['ppo', 'dqn', 'a3c'] and self.model is not None:
            return self.rl_action(tl_id)

        else:
            # Default: keep current phase
            return 0

    def rl_action(self, tl_id: str) -> int:
        """Get action from RL model

        For untrained models, uses a hybrid approach:
        - DQN: Combines Q-values with traffic-aware heuristics
        - PPO/A3C: Uses stochastic policy (already explores)
        """
        try:
            obs = self.get_observation(tl_id)
            obs_tensor = torch.FloatTensor(obs).unsqueeze(0).to(self.device)

            with torch.no_grad():
                if self.algorithm == 'ppo':
                    action = self.model.get_action(obs_tensor)

                elif self.algorithm == 'dqn':
                    if not self.is_trained:
                        # For untrained DQN, use traffic-aware action selection
                        action = self._smart_dqn_action(tl_id, obs)
                    else:
                        # Trained model: use greedy policy
                        q_values = self.model(obs_tensor)
                        action = q_values.argmax().item()

                elif self.algorithm == 'a3c':
                    action = self.model.get_action(obs_tensor)
                else:
                    action = 0

            return action

        except Exception as e:
            logger.error(f"Error in RL action for {tl_id}: {e}")
            return 0

    def _smart_dqn_action(self, tl_id: str, obs: np.ndarray) -> int:
        """
        Smart action selection for untrained DQN models.
        Combines traffic conditions with some randomness.
        """
        try:
            queue_lengths = obs[:4]
            current_phase = traci.trafficlight.getPhase(tl_id)
            current_time = traci.simulation.getTime()
            time_since_switch = current_time - self.last_switch_time.get(tl_id, 0)

            # Map current phase to green phase index
            green_phases = [0, 2, 4, 6]
            if current_phase in green_phases:
                current_green_idx = green_phases.index(current_phase)
            else:
                # In yellow phase, keep current
                return 0

            # Minimum green time: 10 seconds
            if time_since_switch < 10:
                return 0

            # Maximum green time: 45 seconds - force switch
            if time_since_switch >= 45:
                # Switch to direction with most vehicles
                max_queue_idx = int(np.argmax(queue_lengths))
                if max_queue_idx != current_green_idx:
                    return max_queue_idx + 1
                else:
                    # Current direction still has most vehicles, keep it
                    return 0

            # Check if another direction needs service
            current_queue = queue_lengths[current_green_idx]
            max_queue = np.max(queue_lengths)
            max_queue_idx = int(np.argmax(queue_lengths))

            # Switch if another direction has significantly more vehicles
            if max_queue > current_queue + 2 and time_since_switch >= 15:
                return max_queue_idx + 1

            # Small random chance to explore (10%)
            if np.random.random() < 0.1 and time_since_switch >= 20:
                return np.random.randint(0, self.num_actions)

            return 0  # Keep current phase

        except Exception as e:
            logger.error(f"Error in smart DQN action: {e}")
            return 0

    def fixed_time_action(self, tl_id: str) -> int:
        """Fixed-time control: switch phases every 30 seconds

        Note: Cycles through 4 green phases (0,2,4,6) in SUMO's 8-phase system
        """
        try:
            current_time = traci.simulation.getTime()
            time_since_switch = current_time - self.last_switch_time.get(tl_id, 0)

            # Switch every 30 seconds
            if time_since_switch >= 30:
                current_phase = traci.trafficlight.getPhase(tl_id)
                # Map current green phase to next green phase
                green_phases = [0, 2, 4, 6]
                if current_phase in green_phases:
                    current_idx = green_phases.index(current_phase)
                    next_idx = (current_idx + 1) % 4
                    next_green_phase = green_phases[next_idx]
                else:
                    # If in yellow phase, stay in current
                    return 0

                # Return action (1-4 maps to green phases 0,2,4,6)
                return next_idx + 1

            return 0  # Keep current phase

        except Exception as e:
            logger.error(f"Error in fixed-time action for {tl_id}: {e}")
            return 0

    def actuated_action(self, tl_id: str) -> int:
        """Actuated control: switch based on queue lengths

        Note: Works with 4 green phases (0,2,4,6) in SUMO's 8-phase system
        """
        try:
            obs = self.get_observation(tl_id)
            queue_lengths = obs[:4]
            has_emergency = obs[10]

            current_phase = traci.trafficlight.getPhase(tl_id)
            current_time = traci.simulation.getTime()
            time_since_switch = current_time - self.last_switch_time.get(tl_id, 0)

            # Map current phase to green phase index (0-3)
            green_phases = [0, 2, 4, 6]
            if current_phase in green_phases:
                current_green_idx = green_phases.index(current_phase)
            else:
                # In yellow phase, keep current
                return 0

            # Emergency vehicle priority
            if has_emergency > 0.5:
                # Find direction with emergency vehicle and switch to it
                max_queue_idx = int(np.argmax(queue_lengths))
                if max_queue_idx != current_green_idx and time_since_switch >= 5:
                    return max_queue_idx + 1

            # Minimum green time: 10 seconds
            if time_since_switch < 10:
                return 0

            # Maximum green time: 60 seconds
            if time_since_switch >= 60:
                # Switch to direction with most vehicles
                max_queue_idx = int(np.argmax(queue_lengths))
                if max_queue_idx != current_green_idx:
                    return max_queue_idx + 1

            # Switch if another direction has significantly more vehicles
            current_queue = queue_lengths[current_green_idx]
            max_queue = np.max(queue_lengths)

            if max_queue > current_queue + 3 and time_since_switch >= 15:
                max_queue_idx = int(np.argmax(queue_lengths))
                return max_queue_idx + 1

            return 0  # Keep current phase

        except Exception as e:
            logger.error(f"Error in actuated action for {tl_id}: {e}")
            return 0

    def apply_action(self, tl_id: str, action: int):
        """
        Apply action to traffic light

        Args:
            tl_id: Traffic light ID
            action: 0 = keep, 1-4 = switch to phase 0-3

        Note: SUMO traffic lights have 8 phases (0-7):
            - Phases 0,2,4,6 are green phases
            - Phases 1,3,5,7 are yellow transition phases
        """
        try:
            if action == 0:
                # Keep current phase
                return

            # Map action to green phase index (actions 1-4 map to green phases 0,2,4,6)
            green_phase_map = {1: 0, 2: 2, 3: 4, 4: 6}
            target_green_phase = green_phase_map.get(action, 0)

            current_phase = traci.trafficlight.getPhase(tl_id)

            # Only switch if we're not already in the target green phase
            if current_phase != target_green_phase:
                # Set to target green phase directly
                # SUMO will handle yellow transitions automatically if configured
                traci.trafficlight.setPhase(tl_id, target_green_phase)
                self.last_switch_time[tl_id] = traci.simulation.getTime()
                logger.debug(f"{tl_id}: Switched from phase {current_phase} to {target_green_phase}")

        except Exception as e:
            logger.error(f"Error applying action to {tl_id}: {e}")

    def step(self):
        """
        Execute one control step for all traffic lights
        """
        if not self.traffic_lights:
            self.initialize_traffic_lights()

        for tl_id in self.traffic_lights:
            action = self.select_action(tl_id)
            self.apply_action(tl_id, action)

    def reset(self):
        """Reset controller state"""
        self.phase_durations = {}
        self.last_switch_time = {}
        self.traffic_lights = []
        logger.info("RL Controller reset")

    def get_info(self) -> Dict:
        """Get controller information"""
        return {
            'algorithm': self.algorithm,
            'num_traffic_lights': len(self.traffic_lights),
            'model_loaded': self.model is not None,
            'device': str(self.device)
        }


# ==================== HELPER FUNCTIONS ====================

def get_available_models(models_dir='models') -> List[Dict]:
    """
    Get list of available trained models

    Returns:
        List of dicts with model info
    """
    models = []

    if not os.path.exists(models_dir):
        return models

    # Check for PPO models
    for model_dir in Path(models_dir).glob('ppo_*'):
        if model_dir.is_dir():
            # Look for .pth files
            pth_files = list(model_dir.glob('*.pth'))
            if pth_files:
                models.append({
                    'name': model_dir.name,
                    'algorithm': 'ppo',
                    'path': str(pth_files[0]),
                    'timestamp': model_dir.name.split('_')[-1] if '_' in model_dir.name else 'unknown'
                })

    # Check for DQN models
    for model_dir in Path(models_dir).glob('dqn_*'):
        if model_dir.is_dir():
            pth_files = list(model_dir.glob('*.pth'))
            if pth_files:
                models.append({
                    'name': model_dir.name,
                    'algorithm': 'dqn',
                    'path': str(pth_files[0]),
                    'timestamp': model_dir.name.split('_')[-1] if '_' in model_dir.name else 'unknown'
                })

    # Check for A3C models
    for model_dir in Path(models_dir).glob('a3c_*'):
        if model_dir.is_dir():
            pth_files = list(model_dir.glob('*.pth'))
            if pth_files:
                models.append({
                    'name': model_dir.name,
                    'algorithm': 'a3c',
                    'path': str(pth_files[0]),
                    'timestamp': model_dir.name.split('_')[-1] if '_' in model_dir.name else 'unknown'
                })

    # Check for checkpoint files in root
    checkpoints_dir = Path('checkpoints')
    if checkpoints_dir.exists():
        for pth_file in checkpoints_dir.glob('*.pth'):
            if 'ppo' in pth_file.name.lower():
                models.append({
                    'name': pth_file.stem,
                    'algorithm': 'ppo',
                    'path': str(pth_file),
                    'timestamp': 'checkpoint'
                })
            elif 'dqn' in pth_file.name.lower():
                models.append({
                    'name': pth_file.stem,
                    'algorithm': 'dqn',
                    'path': str(pth_file),
                    'timestamp': 'checkpoint'
                })
            elif 'a3c' in pth_file.name.lower():
                models.append({
                    'name': pth_file.stem,
                    'algorithm': 'a3c',
                    'path': str(pth_file),
                    'timestamp': 'checkpoint'
                })

    return models


def create_controller(algorithm='ppo', model_name=None) -> RLController:
    """
    Create RL controller with optional model loading

    Args:
        algorithm: 'ppo', 'dqn', 'a3c', 'fixed', or 'actuated'
        model_name: Name of model to load (optional)

    Returns:
        RLController instance
    """
    model_path = None

    if model_name and algorithm in ['ppo', 'dqn', 'a3c']:
        # Try to find model
        available_models = get_available_models()
        for model in available_models:
            if model['name'] == model_name or model_name in model['path']:
                model_path = model['path']
                break

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    controller = RLController(algorithm=algorithm, model_path=model_path, device=device)

    return controller

