"""Quick test: load model, run inference, train LoRA, compare."""
import os, sys, warnings
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(__file__))
from lora_engine import LoRAEngine

print("=== Loading LoRAEngine ===")
engine = LoRAEngine()
engine.load_model()
print("Model loaded OK")

# Quick base inference
prompts = ["Hello, how are you today?", "What is the capital of France?"]
results = engine.base_inference(prompts, max_length=40)
for r in results:
    print(f'  Prompt: {r["prompt"][:40]}')
    print(f'  Response: {r["response"][:80]}')
    print()

# Create tiny dataset
from main import synthetic_samples as syn
dataset = syn(10, "refusal-safety")
print(f"=== Dataset: {len(dataset)} samples ===")

# Train LoRA
print("=== Training LoRA (10 steps) ===")
metrics = engine.train_lora(dataset, steps=10)
print(f"Loss: {metrics['final_loss']}, Reward: {metrics['final_reward']}")
print(f"Trainable params: {metrics['trainable_params']:,}")

# LoRA inference
print("=== LoRA Inference ===")
lora_results = engine.lora_inference(prompts, max_length=40)
for i, r in enumerate(lora_results):
    print(f'  Prompt: {r["prompt"][:40]}')
    print(f'  Base: {results[i]["response"][:80]}')
    print(f'  LoRA: {r["response"][:80]}')
    print()

# Full comparison
print("=== Full Comparison ===")
report = engine.generate_comparison(dataset, max_length=30)
print(f"Summary: {report['summary']}")
print(f"Failed: {len(report['failed_prompts'])}/{report['summary']['total']}")
print("ALL OK")
