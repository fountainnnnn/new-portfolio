# backend/src/core/bootstrap.py
from pathlib import Path
import easyocr

# Bundled weights inside the repo
EASYOCR_MODELS = Path(__file__).resolve().parent.parent / "models" / "easyocr"
# Temp dir for writable cache
EASYOCR_CACHE = Path("/tmp/.easyocr_cache")

EASYOCR_MODELS.mkdir(parents=True, exist_ok=True)
EASYOCR_CACHE.mkdir(parents=True, exist_ok=True)

def ensure_easyocr_weights(lang: str = "en"):
    print("[BOOTSTRAP] EasyOCR init")
    print(f"  Using weights from {EASYOCR_MODELS}")
    print(f"  Using cache in {EASYOCR_CACHE}")

    reader = easyocr.Reader(
        [lang],
        model_storage_directory=str(EASYOCR_MODELS),   # bundled weights
        user_network_directory=str(EASYOCR_CACHE),     # writable temp
        download_enabled=False,                        # don’t redownload
        gpu=False,
    )
    return reader
