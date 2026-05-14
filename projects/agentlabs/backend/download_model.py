"""
Download a tiny GPT-2 model for LoRA training demos.

Downloads `distilbert/distilgpt2` (≈350 MB) to `backend/.models/distilgpt2/`.
Falls back to `sshleifer/tiny-gpt2` (≈50 MB) if the first model is too large
or download fails.
"""

import sys
import time
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent / ".models"


def download_model(model_name: str) -> Path:
    """Download model using transformers from_pretrained. Returns model path."""
    print(f"[download_model] Downloading {model_name} ...")
    from transformers import AutoModelForCausalLM, AutoTokenizer

    model_path = MODELS_DIR / model_name.replace("/", "_")
    if model_path.exists() and any(model_path.iterdir()):
        print(f"[download_model] Already cached at {model_path}")
        return model_path

    model_path.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    elapsed = time.time() - t0

    # Save locally
    model.save_pretrained(model_path)
    tokenizer.save_pretrained(model_path)
    print(f"[download_model] Done in {elapsed:.1f}s. Saved to {model_path}")
    return model_path


def main():
    # Try primary model first
    primary = "distilbert/distilgpt2"
    try:
        download_model(primary)
        print(f"\n[OK] Model '{primary}' downloaded successfully.")
    except Exception as exc:
        print(f"[WARN] Failed to download '{primary}': {exc}", file=sys.stderr)
        fallback = "sshleifer/tiny-gpt2"
        print(f"[INFO] Falling back to '{fallback}' ...")
        try:
            download_model(fallback)
            print(f"\n[OK] Model '{fallback}' downloaded successfully.")
        except Exception as exc2:
            print(f"[ERROR] Also failed to download '{fallback}': {exc2}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
