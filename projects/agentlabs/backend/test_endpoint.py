"""Test the real LoRA report endpoint directly."""
import os, sys, warnings, json
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(__file__))
from main import synthetic_samples
from lora_engine import get_engine

print("=== Get engine ===")
engine = get_engine()
print(f"Model: {engine.model_name}, device: {engine.device}")

print("=== Create dataset ===")
dataset = synthetic_samples(12, "refusal-safety")
print(f"Dataset size: {len(dataset)}")

print("=== Generate comparison ===")
report = engine.generate_comparison(dataset, max_length=30)
print(f"Summary: {json.dumps(report['summary'], indent=2)}")

# Save to file for inspection
with open(os.path.join(os.path.dirname(__file__), ".models", "test_report.json"), "w") as f:
    json.dump(report, f, indent=2, default=str)
print(f"Report saved ({len(report['comparisons'])} comparisons)")

# Show a few comparisons
for c in report["comparisons"][:3]:
    print(f"\nPrompt: {c['prompt'][:60]}...")
    print(f"  Base: {c['base_response'][:60]}...")
    print(f"  LoRA: {c['lora_response'][:60]}...")
    print(f"  Target: {c['target'][:60]}...")
    print(f"  Passed: {c['passed']} (base={c['base_score']:.3f}, lora={c['lora_score']:.3f})")

print("\n=== DONE ===")
