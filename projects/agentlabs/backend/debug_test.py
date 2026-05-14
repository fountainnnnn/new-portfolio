"""Quick debug: show the test report data via the API"""
import json, urllib.request

try:
    req = urllib.request.Request(
        "http://127.0.0.1:3005/api/lora/real/report",
        method="POST",
        data=b'{}',
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    
    print("Keys:", list(data.keys()))
    if "summary" in data:
        s = data["summary"]
        print(f"Passed: {s['passed']}/{s['total']} ({s['pass_rate']*100:.0f}%)")
        print(f"Avg base: {s['avg_base_score']:.3f}, Avg lora: {s['avg_lora_score']:.3f}")
        print(f"Improvement: +{s['improvement']*100:.2f}%")
    if "error" in data:
        print("ERROR:", data["error"])
    print("Full data keys OK")
except Exception as e:
    print(f"FAILED: {e}")
