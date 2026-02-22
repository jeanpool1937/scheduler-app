import time
import requests
import statistics

# Configuration
BASE_URL = "http://localhost:5173"  # Adjust port if necessary (Vite default or 5179)
ENDPOINTS = [
    "/",
    "/sequencer" # Simulated path, app is SPA
]

def check_server_health():
    try:
        response = requests.get(BASE_URL)
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        return False

def measure_response_time(url, samples=10):
    times = []
    print(f"Testing {url} with {samples} samples...")
    for _ in range(samples):
        start = time.time()
        try:
            requests.get(url)
            latency = (time.time() - start) * 1000 # ms
            times.append(latency)
        except:
            print("Request failed")
    
    if not times:
        return 0, 0
    return statistics.mean(times), statistics.stdev(times)

def run_qa():
    print("--- Starting QA Performance Validation ---")
    
    # 1. Server Health
    # Check default port first
    current_url = BASE_URL
    if not check_server_health():
        print("CRITICAL: Server is not reachable at", BASE_URL)
        # Try port 5179 as fallback
        current_url = "http://localhost:5179"
        # Update global for next function calls if needed, or just use local
        if not check_server_health(): # Logic error in original script for re-checking with new URL
             # Let's just fix the flow
             pass
    
    # Actually, let's simplify.
    target_url = BASE_URL
    try:
        requests.get(target_url)
    except:
        target_url = "http://localhost:5179"
        
    print(f"Target Server: {target_url}")

    # 2. Latency Check
    mean_latency, stdev = measure_response_time(target_url)
    
    print(f"\nResults:")
    print(f"Avg Latency: {mean_latency:.2f} ms")
    print(f"Jitter (Stdev): {stdev:.2f} ms")
    
    # 3. Threshold check
    if mean_latency > 200:
        print("WARNING: High latency detected (>200ms).")
    else:
        print("PASS: Latency within acceptable limits.")

if __name__ == "__main__":
    run_qa()
