@echo off
echo [RL-Pilot] Installing Dependencies...
py -m pip install -r backend\rl_agent\requirements.txt

if %errorlevel% neq 0 (
    echo [RL-Pilot] Error installing dependencies.
    exit /b %errorlevel%
)

echo [RL-Pilot] Starting Training...
py backend\rl_agent\train_pilot.py

if %errorlevel% neq 0 (
    echo [RL-Pilot] Error during training.
    exit /b %errorlevel%
)

echo [RL-Pilot] Success!
