#!/usr/bin/env python3
"""
PPO Training for Multi-Agent Traffic Light Control
Uses Stable-Baselines3 with parameter sharing and centralized critic
"""

import os
import sys
import numpy as np
import torch
import torch.nn as nn
from torch.optim import Adam
import traci
from collections import defaultdict
import json
from datetime import datetime

# Import SUMO environment
from sumo_rl_environment import SUMOEnvironment, VEHICLE_WEIGHTS, EMERGENCY_VEHICLES

# Check for GPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

class ActorCriticNetwork(nn.Module):
    """
    Actor-Critic network with parameter sharing.
    Actor: outputs action probabilities
    Critic: outputs state value
    """
    
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
        """Forward pass."""
        features = self.shared(obs)
        action_probs = self.actor(features)
        state_value = self.critic(features)
        return action_probs, state_value
    
    def get_action(self, obs):
        """Sample action from policy."""
        action_probs, _ = self.forward(obs)
        dist = torch.distributions.Categorical(action_probs)
        action = dist.sample()
        log_prob = dist.log_prob(action)
        return action.item(), log_prob
    
    def evaluate(self, obs, action):
        """Evaluate action."""
        action_probs, state_value = self.forward(obs)
        dist = torch.distributions.Categorical(action_probs)
        log_prob = dist.log_prob(action)
        entropy = dist.entropy()
        return log_prob, state_value, entropy

class CentralizedCritic(nn.Module):
    """
    Centralized critic that sees global state during training.
    """
    
    def __init__(self, global_obs_dim, hidden_dim=256):
        super(CentralizedCritic, self).__init__()
        
        self.network = nn.Sequential(
            nn.Linear(global_obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        )
    
    def forward(self, global_obs):
        """Forward pass."""
        return self.network(global_obs)

class PPOTrainer:
    """
    Improved PPO trainer with adaptive hyperparameters and exploration strategies.
    """

    def __init__(self, obs_dim, action_dim, num_agents=9, lr=3e-4, gamma=0.99,
                 eps_clip=0.2, K_epochs=4, use_centralized_critic=True,
                 adaptive_lr=True, entropy_bonus=0.01):
        self.obs_dim = obs_dim
        self.action_dim = action_dim
        self.num_agents = num_agents
        self.gamma = gamma
        self.eps_clip = eps_clip
        self.K_epochs = K_epochs
        self.use_centralized_critic = use_centralized_critic
        self.adaptive_lr = adaptive_lr
        self.entropy_bonus = entropy_bonus

        # Shared actor-critic network (parameter sharing)
        self.policy = ActorCriticNetwork(obs_dim, action_dim).to(device)
        self.optimizer = Adam(self.policy.parameters(), lr=lr)

        # Centralized critic (optional, for training only)
        if use_centralized_critic:
            global_obs_dim = obs_dim * num_agents
            self.centralized_critic = CentralizedCritic(global_obs_dim).to(device)
            self.critic_optimizer = Adam(self.centralized_critic.parameters(), lr=lr)

        # Old policy for PPO
        self.policy_old = ActorCriticNetwork(obs_dim, action_dim).to(device)
        self.policy_old.load_state_dict(self.policy.state_dict())

        # Loss function
        self.MseLoss = nn.MSELoss()

        # Adaptive learning rate scheduler
        if self.adaptive_lr:
            self.lr_scheduler = torch.optim.lr_scheduler.StepLR(self.optimizer, step_size=100, gamma=0.95)

        # Memory with improved capacity management
        self.memory = {
            'observations': [],
            'actions': [],
            'log_probs': [],
            'rewards': [],
            'dones': [],
            'global_observations': []
        }

        # Training statistics for adaptation
        self.episode_count = 0
        self.avg_reward_history = []
        self.exploration_rate = 1.0
    
    def select_action(self, observations):
        """
        Select actions for all agents.
        observations: dict of {agent_id: obs_array}
        """
        actions = {}
        log_probs = {}
        
        for agent_id, obs in observations.items():
            obs_tensor = torch.FloatTensor(obs).unsqueeze(0).to(device)
            
            with torch.no_grad():
                action, log_prob = self.policy_old.get_action(obs_tensor)
            
            actions[agent_id] = action
            log_probs[agent_id] = log_prob
        
        return actions, log_probs
    
    def store_transition(self, observations, actions, log_probs, rewards, done):
        """Store transition in memory."""
        # Store individual observations
        for agent_id in observations.keys():
            self.memory['observations'].append(observations[agent_id])
            self.memory['actions'].append(actions[agent_id])
            self.memory['log_probs'].append(log_probs[agent_id])
            self.memory['rewards'].append(rewards[agent_id])
            self.memory['dones'].append(done)
        
        # Store global observation (concatenate all agent observations)
        if self.use_centralized_critic:
            global_obs = np.concatenate([observations[aid] for aid in sorted(observations.keys())])
            self.memory['global_observations'].append(global_obs)
    
    def update(self):
        """Update policy using improved PPO with adaptive parameters."""
        # Convert memory to tensors
        observations = torch.FloatTensor(np.array(self.memory['observations'])).to(device)
        actions = torch.LongTensor(self.memory['actions']).to(device)
        old_log_probs = torch.stack(self.memory['log_probs']).detach().to(device)
        rewards = torch.FloatTensor(self.memory['rewards']).to(device)

        # Calculate discounted rewards with improved normalization
        discounted_rewards = []
        discounted_reward = 0
        for reward, done in zip(reversed(self.memory['rewards']), reversed(self.memory['dones'])):
            if done:
                discounted_reward = 0
            discounted_reward = reward + self.gamma * discounted_reward
            discounted_rewards.insert(0, discounted_reward)

        discounted_rewards = torch.FloatTensor(discounted_rewards).to(device)

        # Adaptive reward normalization based on training progress
        if len(self.avg_reward_history) > 10:
            recent_avg = np.mean(self.avg_reward_history[-10:])
            if abs(recent_avg) > 1e-6:
                discounted_rewards = (discounted_rewards - discounted_rewards.mean()) / (discounted_rewards.std() + 1e-7)
        else:
            discounted_rewards = (discounted_rewards - discounted_rewards.mean()) / (discounted_rewards.std() + 1e-7)

        # PPO update for K epochs with adaptive clipping
        for epoch in range(self.K_epochs):
            # Evaluate actions
            log_probs, state_values, entropy = self.policy.evaluate(observations, actions)
            state_values = state_values.squeeze()

            # Calculate advantages
            if self.use_centralized_critic:
                # Use centralized critic
                global_obs = torch.FloatTensor(np.array(self.memory['global_observations'])).to(device)
                centralized_values = self.centralized_critic(global_obs).squeeze()
                advantages = discounted_rewards - centralized_values.detach()
            else:
                # Use local critic
                advantages = discounted_rewards - state_values.detach()

            # Normalize advantages
            advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-7)

            # Adaptive epsilon clipping based on training progress
            adaptive_eps_clip = self.eps_clip
            if self.episode_count > 100:
                # Reduce clipping as training progresses for finer updates
                adaptive_eps_clip = max(0.1, self.eps_clip * 0.9)

            # Calculate PPO loss
            ratios = torch.exp(log_probs - old_log_probs)
            surr1 = ratios * advantages
            surr2 = torch.clamp(ratios, 1 - adaptive_eps_clip, 1 + adaptive_eps_clip) * advantages

            # Actor loss
            actor_loss = -torch.min(surr1, surr2).mean()

            # Critic loss
            if self.use_centralized_critic:
                critic_loss = self.MseLoss(centralized_values, discounted_rewards)
            else:
                critic_loss = self.MseLoss(state_values, discounted_rewards)

            # Adaptive entropy bonus (decreases over time)
            entropy_weight = max(0.001, self.entropy_bonus * (1 - self.episode_count / 1000))
            entropy_loss = -entropy_weight * entropy.mean()

            # Total loss
            loss = actor_loss + 0.5 * critic_loss + entropy_loss

            # Update actor-critic
            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.policy.parameters(), 0.5)
            self.optimizer.step()

            # Update centralized critic
            if self.use_centralized_critic:
                self.critic_optimizer.zero_grad()
                critic_loss.backward()
                torch.nn.utils.clip_grad_norm_(self.centralized_critic.parameters(), 0.5)
                self.critic_optimizer.step()

        # Update learning rate if adaptive
        if self.adaptive_lr:
            self.lr_scheduler.step()

        # Copy new weights to old policy
        self.policy_old.load_state_dict(self.policy.state_dict())

        # Clear memory
        self.memory = {
            'observations': [],
            'actions': [],
            'log_probs': [],
            'rewards': [],
            'dones': [],
            'global_observations': []
        }

        return {
            'actor_loss': actor_loss.item(),
            'critic_loss': critic_loss.item(),
            'entropy': entropy.mean().item(),
            'learning_rate': self.optimizer.param_groups[0]['lr']
        }
    
    def save(self, filepath):
        """Save model."""
        torch.save({
            'policy_state_dict': self.policy.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'centralized_critic_state_dict': self.centralized_critic.state_dict() if self.use_centralized_critic else None,
            'critic_optimizer_state_dict': self.critic_optimizer.state_dict() if self.use_centralized_critic else None,
        }, filepath)
        print(f"Model saved to {filepath}")
    
    def load(self, filepath):
        """Load model."""
        checkpoint = torch.load(filepath)
        self.policy.load_state_dict(checkpoint['policy_state_dict'])
        self.policy_old.load_state_dict(checkpoint['policy_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        if self.use_centralized_critic and checkpoint['centralized_critic_state_dict']:
            self.centralized_critic.load_state_dict(checkpoint['centralized_critic_state_dict'])
            self.critic_optimizer.load_state_dict(checkpoint['critic_optimizer_state_dict'])
        print(f"Model loaded from {filepath}")

def train_ppo(num_episodes=1000, max_steps=1000, update_interval=2048, save_interval=100):
    """
    Main training loop for PPO.
    """
    print("=" * 70)
    print("PPO TRAINING FOR MULTI-AGENT TRAFFIC LIGHT CONTROL")
    print("=" * 70)
    print()
    
    # Create environment
    env = SUMOEnvironment(sumo_config='Grid-1.sumocfg', gui=False)
    
    # Get observation and action dimensions
    # Assuming ~20 values per agent observation
    obs_dim = 20
    action_dim = 5  # 0: keep, 1: NS green, 2: EW green, 3: extend +5s, 4: extend +10s
    num_agents = 9
    
    # Create PPO trainer
    trainer = PPOTrainer(
        obs_dim=obs_dim,
        action_dim=action_dim,
        num_agents=num_agents,
        lr=3e-4,
        gamma=0.99,
        eps_clip=0.2,
        K_epochs=4,
        use_centralized_critic=True
    )
    
    # Training metrics
    episode_rewards = []
    episode_ev_delays = []
    
    # Create checkpoint directory
    os.makedirs('checkpoints', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    
    # Training loop
    total_steps = 0
    
    for episode in range(num_episodes):
        observations = env.reset()
        episode_reward = 0
        episode_steps = 0
        
        for step in range(max_steps):
            # Select actions
            actions, log_probs = trainer.select_action(observations)
            
            # Execute actions
            next_observations, rewards, done, info = env.step(actions)
            
            # Store transition
            trainer.store_transition(observations, actions, log_probs, rewards, done)
            
            # Update metrics
            episode_reward += sum(rewards.values())
            episode_steps += 1
            total_steps += 1
            
            # Update policy
            if total_steps % update_interval == 0:
                losses = trainer.update()
                print(f"  Update at step {total_steps}: "
                      f"Actor Loss={losses['actor_loss']:.4f}, "
                      f"Critic Loss={losses['critic_loss']:.4f}, "
                      f"Entropy={losses['entropy']:.4f}")
            
            observations = next_observations
            
            if done:
                break
        
        # Episode summary
        episode_rewards.append(episode_reward)
        avg_reward = np.mean(episode_rewards[-100:])
        
        print(f"Episode {episode+1}/{num_episodes}: "
              f"Reward={episode_reward:.2f}, "
              f"Avg(100)={avg_reward:.2f}, "
              f"Steps={episode_steps}, "
              f"EVs={info.get('ev_count', 0)}")
        
        # Save checkpoint
        if (episode + 1) % save_interval == 0:
            checkpoint_path = f'checkpoints/ppo_episode_{episode+1}.pth'
            trainer.save(checkpoint_path)
            
            # Save metrics
            metrics = {
                'episode': episode + 1,
                'episode_rewards': episode_rewards,
                'avg_reward': avg_reward
            }
            with open(f'logs/metrics_episode_{episode+1}.json', 'w') as f:
                json.dump(metrics, f, indent=2)
    
    # Save final model
    trainer.save('checkpoints/ppo_final.pth')
    
    # Close environment
    env.close()
    
    print()
    print("=" * 70)
    print("TRAINING COMPLETE!")
    print(f"Final average reward (last 100 episodes): {np.mean(episode_rewards[-100:]):.2f}")
    print("=" * 70)

if __name__ == '__main__':
    train_ppo(num_episodes=1000, max_steps=1000, update_interval=2048, save_interval=100)

