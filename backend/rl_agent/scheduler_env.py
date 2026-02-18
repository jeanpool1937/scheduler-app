import gymnasium as gym
from gymnasium import spaces
import numpy as np
import random

class SchedulerEnv(gym.Env):
    """
    Custom Environment that follows gym interface.
    Simulates a Genetic Algorithm process for the Scheduler.
    """
    metadata = {'render.modes': ['console']}

    def __init__(self):
        super(SchedulerEnv, self).__init__()
        
        # Actions: 0=Decrease Mutation, 1=Maintain, 2=Increase
        self.action_space = spaces.Discrete(3)
        
        # Observation: [StagnationCount (0-50), CurrentMutationRate (0.0-1.0), GenerationProgress (0.0-1.0)]
        self.observation_space = spaces.Box(low=0, high=1, shape=(3,), dtype=np.float32)
        
        self.reset()

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self.current_generation = 0
        self.max_generations = 100
        self.stagnation_counter = 0
        self.current_mutation_rate = 0.05 # Initial guess
        self.best_fitness = 1000.0 # Lower is better (Cost)
        
        # Simulated "Optimal" mutation rate changes over time to make it tricky
        self.target_optimal_rate = 0.1 
        
        return self._get_obs(), {}

    def _get_obs(self):
        return np.array([
            self.stagnation_counter / 50.0, # Normalized stagnation
            self.current_mutation_rate,
            self.current_generation / self.max_generations
        ], dtype=np.float32)

    def step(self, action):
        self.current_generation += 1
        
        # 1. Apply Action
        if action == 0: # Decrease
            self.current_mutation_rate = max(0.01, self.current_mutation_rate - 0.01)
        elif action == 2: # Increase
            self.current_mutation_rate = min(0.5, self.current_mutation_rate + 0.01)
        # action 1 is maintain
        
        # 2. Simulate Environment Reaction (Genetic Algorithm Step)
        # Logic: If mutation rate is close to "optimal", we improve fitness.
        # If we are stagnant, we need HIGH mutation to break out.
        
        improvement = 0
        noise = random.uniform(-5, 5)
        
        # Distance to optimal rate
        dist = abs(self.current_mutation_rate - self.target_optimal_rate)
        
        if self.stagnation_counter > 10:
            # We are stuck in local optima
            self.target_optimal_rate = 0.3 # Moving target: Needs high mutation to escape
            if self.current_mutation_rate > 0.2:
                improvement = 50 + noise # Big jump!
                self.stagnation_counter = 0 # Reset stagnation
                self.target_optimal_rate = 0.05 # Needs low mutation now to refine
            else:
                self.stagnation_counter += 1
        else:
            # Normal convergence phase
            if dist < 0.05:
                improvement = 10 + noise
                self.stagnation_counter = 0
            else:
                improvement = 0 # No improvement if rate is wrong
                self.stagnation_counter += 1
        
        previous_fitness = self.best_fitness
        self.best_fitness = max(0, self.best_fitness - improvement)
        
        # 3. Calculate Reward
        # Base reward = Improvement
        reward = (previous_fitness - self.best_fitness)
        
        # Penalize stagnation
        if self.stagnation_counter > 0:
            reward -= 1 
            
        # 4. Check Done
        terminated = self.current_generation >= self.max_generations
        truncated = False
        
        info = {
            "fitness": self.best_fitness, 
            "mutation_rate": self.current_mutation_rate
        }
        
        return self._get_obs(), reward, terminated, truncated, info

    def render(self, mode='console'):
        if mode == 'console':
            print(f"Gen: {self.current_generation} | Mut: {self.current_mutation_rate:.2f} | Stag: {self.stagnation_counter} | Fit: {self.best_fitness:.2f}")

    def close(self):
        pass
