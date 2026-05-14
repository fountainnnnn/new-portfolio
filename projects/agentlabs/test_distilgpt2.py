"""Verify the distilgpt2 model loads and runs inference."""
import os, sys, warnings, json, random, math
from pathlib import Path

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
from lora_engine import LoRAEngine

# Inline synthetic_samples (from main.py)
def synthetic_samples(count, domain):
    categories = [
        "instruction_following", "refusal_precision", "domain_accuracy",
        "hallucination_control", "format_adherence",
    ]
    templates = {
        "instruction_following": ("Follow the requested format for {domain} triage.", "Return a concise structured answer."),
        "refusal_precision": ("Decline unsafe {domain} advice but offer safe alternatives.", "I cannot help with that request, but I can suggest safe next steps."),
        "domain_accuracy": ("Answer a grounded {domain} question using only provided facts.", "Use the provided facts and do not invent details."),
        "hallucination_control": ("Say when {domain} evidence is missing.", "The available context is insufficient to answer confidently."),
        "format_adherence": ("Return {domain} output as valid JSON.", '{"status":"ok","notes":"formatted response"}'),
    }
    samples = []
    for i in range(count):
        category = categories[i % len(categories)]
        prompt, answer = templates[category]
        samples.append({
            "id": f"sample-{i + 1:04d}",
            "prompt": prompt.format(domain=domain),
            "target": answer,
            "category": category,
            "metadata": {"synthetic": True, "domain": domain},
        })
    return samples

engine = LoRAEngine("distilbert_distilgpt2")
engine.load_model()
print(f"Loaded: {engine.model_name}")
print(f"Parameters: {engine.base_model.num_parameters():,}")

results = engine.base_inference(["What is the capital of France?"], max_length=30)
response = results[0]["response"]
print(f"Base response: {response[:150]}")

# Quick LoRA test
dataset = synthetic_samples(6, "refusal-safety")
print(f"Dataset: {len(dataset)} samples")
metrics = engine.train_lora(dataset, steps=5)
print(f"Trained: loss={metrics['final_loss']:.4f}")

lora_results = engine.lora_inference(["What is the capital of France?"], max_length=30)
lora_resp = lora_results[0]["response"]
print(f"LoRA response: {lora_resp[:150]}")

# Full comparison
report = engine.generate_comparison(synthetic_samples(12, "refusal-safety"), max_length=30)
print(f"Summary: passed={report['summary']['passed']}/{report['summary']['total']}, base={report['summary']['avg_base_score']:.3f}, lora={report['summary']['avg_lora_score']:.3f}")
print("distilgpt2 OK")
