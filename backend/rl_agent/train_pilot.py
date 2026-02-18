import os
import time
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from scheduler_env import SchedulerEnv

def train():
    print("Initializing Scheduler Simulation Environment...")
    env = SchedulerEnv()
    
    # Instantiate the agent
    model = PPO("MlpPolicy", env, verbose=1)
    
    print("Starting Training (10,000 timesteps)...")
    start_time = time.time()
    model.learn(total_timesteps=10000)
    
    print(f"Training Complete in {time.time() - start_time:.2f}s")
    
    # Save the model
    save_path = "rl_pilot_v1"
    model.save(save_path)
    print(f"Model saved to {save_path}.zip")
    
    # Test the trained agent
    print("\n--- Testing Trained Agent ---")
    obs, _ = env.reset()
    total_reward = 0
    for i in range(100):
        action, _states = model.predict(obs, deterministic=True)
        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        env.render()
        if terminated or truncated:
            break
            
    print(f"Test Run Total Reward: {total_reward}")

if __name__ == "__main__":
    train()
