from __future__ import annotations

import json
import math
import random
import time
import uuid
from datetime import datetime, timezone
from importlib.util import find_spec
from pathlib import Path
from typing import Any, Literal

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / ".agentlabs"
DATASET_DIR = STATE_DIR / "datasets"
JOB_DIR = STATE_DIR / "jobs"
EXPORT_DIR = STATE_DIR / "exports"
MODEL_PARAMETER_COUNTS = {
    "gpt2": 124_439_808,
    "distilbert/distilgpt2": 81_912_576,
    "sshleifer/tiny-gpt2": 102_714,
}

for directory in (DATASET_DIR, JOB_DIR, EXPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def has_module(name: str) -> bool:
    return find_spec(name) is not None


def runtime_info() -> dict[str, Any]:
    deps = {
        "torch": has_module("torch"),
        "transformers": has_module("transformers"),
        "peft": has_module("peft"),
        "accelerate": has_module("accelerate"),
    }
    return {
        "real_lora_dependencies_available": all(deps.values()),
        "dependencies": deps,
        "default_mode": "real_capable" if all(deps.values()) else "simulation",
        "truthfulness": [
            "AgentLabs trains or simulates LoRA adapters only.",
            "Simulation mode does not update model weights.",
            "Exports always label real_or_simulated.",
        ],
    }


def resolve_cached_model_path(model_id: str) -> Path | None:
    local_path = ROOT / ".models" / model_id.replace("/", "_")
    if local_path.exists() and (local_path / "model.safetensors").exists():
        return local_path

    snapshot_dir = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_id.replace('/', '--')}" / "snapshots"
    if snapshot_dir.exists():
        snapshots = sorted(snapshot_dir.iterdir(), key=lambda path: path.stat().st_mtime, reverse=True)
        for snapshot in snapshots:
            if (snapshot / "model.safetensors").exists() or (snapshot / "pytorch_model.bin").exists():
                return snapshot
    return None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Not found: {path.stem}")
    return json.loads(path.read_text(encoding="utf-8"))


def summarize_dataset(samples: list[dict[str, Any]]) -> dict[str, Any]:
    categories: dict[str, int] = {}
    for sample in samples:
        category = str(sample.get("category", "general"))
        categories[category] = categories.get(category, 0) + 1
    return {
        "total_samples": len(samples),
        "categories": categories,
        "preview": samples[:10],
    }


def synthetic_samples(count: int, domain: str) -> list[dict[str, Any]]:
    categories = [
        "instruction_following",
        "refusal_precision",
        "domain_accuracy",
        "hallucination_control",
        "format_adherence",
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
        samples.append(
            {
                "id": f"sample-{i + 1:04d}",
                "prompt": prompt.format(domain=domain),
                "target": answer,
                "category": category,
                "metadata": {"synthetic": True, "domain": domain},
            }
        )
    return samples


def score_samples(samples: list[dict[str, Any]], improvement: float = 0.0) -> dict[str, Any]:
    total = max(len(samples), 1)
    category_scores: dict[str, list[float]] = {}
    traces = []
    for index, sample in enumerate(samples):
        category = sample.get("category", "general")
        base = 0.56 + (index % 11) * 0.025
        penalty = 0.12 if category in {"refusal_precision", "hallucination_control"} else 0.04
        score = min(0.97, max(0.05, base - penalty + improvement))
        category_scores.setdefault(category, []).append(score)
        traces.append(
            {
                "sample_id": sample.get("id", f"sample-{index + 1}"),
                "category": category,
                "reward": round(score, 4),
                "passed": score >= 0.72,
            }
        )
    avg = sum(t["reward"] for t in traces) / total
    passed = sum(1 for t in traces if t["passed"])
    return {
        "total": len(samples),
        "passed": passed,
        "failed": len(samples) - passed,
        "pass_rate": round(passed / total, 4),
        "reward_score": round(avg, 4),
        "category_scores": {
            key: round(sum(values) / len(values), 4)
            for key, values in category_scores.items()
        },
        "traces": traces[:50],
    }


class ModelSelection(BaseModel):
    model_id: str = "demo-tiny-lora-target"
    source: Literal["demo", "local_path", "huggingface"] = "demo"
    model_path: str | None = None
    tokenizer_path: str | None = None


class SyntheticDatasetRequest(BaseModel):
    name: str = "synthetic-lora-safety"
    domain: str = "customer-support"
    count: int = Field(default=80, ge=5, le=2000)


class BaselineEvalRequest(BaseModel):
    dataset_id: str
    model: ModelSelection = Field(default_factory=ModelSelection)


class TrainRequest(BaseModel):
    dataset_id: str
    model: ModelSelection = Field(default_factory=ModelSelection)
    adapter_name: str = "agentlabs-lora-adapter"
    rank: int = Field(default=8, ge=1, le=256)
    alpha: int = Field(default=16, ge=1, le=512)
    dropout: float = Field(default=0.05, ge=0.0, le=0.9)
    learning_rate: float = Field(default=2e-4, ge=1e-7, le=1.0)
    steps: int = Field(default=80, ge=1, le=2000)
    batch_size: int = Field(default=8, ge=1, le=256)


class CheckpointEvalRequest(BaseModel):
    job_id: str
    dataset_id: str | None = None


class ExportRequest(BaseModel):
    job_id: str
    include_dataset_preview: bool = True


app = FastAPI(
    title="AgentLabs Backend",
    description="LoRA-only workflow backend with truthful simulation fallback.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    info = runtime_info()
    return {
        "status": "ok",
        "product": "AgentLabs",
        "surface": "lora-only",
        "mode": info["default_mode"],
        "runtime": info,
    }


@app.get("/api/lora/config")
def lora_config() -> dict[str, Any]:
    return {
        "defaults": {
            "rank": 8,
            "alpha": 16,
            "dropout": 0.05,
            "learning_rate": 2e-4,
            "steps": 80,
            "batch_size": 8,
        },
        "reward_components": [
            "answer_correctness",
            "refusal_precision",
            "hallucination_penalty",
            "format_adherence",
            "latency_penalty",
        ],
        "runtime": runtime_info(),
    }


@app.get("/api/lora/models")
def list_models() -> dict[str, Any]:
    gpt2_path = resolve_cached_model_path("gpt2")
    distilgpt2_path = resolve_cached_model_path("distilbert/distilgpt2") or resolve_cached_model_path("distilbert_distilgpt2")
    tiny_gpt2_path = resolve_cached_model_path("sshleifer/tiny-gpt2") or resolve_cached_model_path("sshleifer_tiny-gpt2")
    deps_ready = runtime_info()["real_lora_dependencies_available"]
    return {
        "models": [
            {
                "id": "gpt2",
                "name": "GPT-2 Small",
                "source": "local_path",
                "model_path": str(gpt2_path) if gpt2_path else None,
                "parameters": "124,439,808",
                "total_parameters": MODEL_PARAMETER_COUNTS["gpt2"],
                "real_or_simulated": "real_local_model" if gpt2_path and deps_ready else "unavailable",
                "description": "Recommended local open-weight model for useful hackathon LoRA tests.",
            },
            {
                "id": "demo-tiny-lora-target",
                "name": "Demo Tiny LoRA Target",
                "source": "demo",
                "model_path": None,
                "parameters": "simulation",
                "total_parameters": None,
                "real_or_simulated": "simulated",
                "description": "Always available demo target for hackathon walkthroughs.",
            },
            {
                "id": "distilbert/distilgpt2",
                "name": "DistilGPT2",
                "source": "local_path",
                "model_path": str(distilgpt2_path) if distilgpt2_path else None,
                "parameters": "81,912,576",
                "total_parameters": MODEL_PARAMETER_COUNTS["distilbert/distilgpt2"],
                "real_or_simulated": "real_local_model" if distilgpt2_path and deps_ready else "unavailable",
                "description": "Smaller local model; fast, but lower-quality generations.",
            },
            {
                "id": "sshleifer/tiny-gpt2",
                "name": "Tiny GPT-2 Smoke Test",
                "source": "local_path",
                "model_path": str(tiny_gpt2_path) if tiny_gpt2_path else None,
                "parameters": "102,714",
                "total_parameters": MODEL_PARAMETER_COUNTS["sshleifer/tiny-gpt2"],
                "real_or_simulated": "real_local_model" if tiny_gpt2_path and deps_ready else "unavailable",
                "description": "Very fast smoke-test model, not suitable for useful outputs.",
            },
        ],
        "runtime": runtime_info(),
    }


@app.post("/api/lora/models/select")
def select_model(selection: ModelSelection) -> dict[str, Any]:
    real_ready = (
        selection.source == "local_path"
        and bool(selection.model_path)
        and Path(selection.model_path).exists()
        and runtime_info()["real_lora_dependencies_available"]
    )
    return {
        "model": selection.model_dump(),
        "real_or_simulated": "real_capable" if real_ready else "simulated",
        "ready": True,
        "limitations": [] if real_ready else ["Real LoRA requires torch, transformers, peft, accelerate, and an existing local model path."],
    }


@app.post("/api/lora/datasets/synthetic")
def create_synthetic_dataset(request: SyntheticDatasetRequest) -> dict[str, Any]:
    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    samples = synthetic_samples(request.count, request.domain)
    payload = {
        "dataset_id": dataset_id,
        "name": request.name,
        "created_at": utc_now(),
        "real_or_simulated": "simulated",
        "samples": samples,
        "summary": summarize_dataset(samples),
    }
    write_json(DATASET_DIR / f"{dataset_id}.json", payload)
    return {k: v for k, v in payload.items() if k != "samples"} | {"preview": samples[:10]}


@app.post("/api/lora/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    text = (await file.read()).decode("utf-8")
    samples: list[dict[str, Any]] = []
    try:
        if file.filename and file.filename.endswith(".jsonl"):
            samples = [json.loads(line) for line in text.splitlines() if line.strip()]
        else:
            raw = json.loads(text)
            samples = raw if isinstance(raw, list) else raw.get("samples", [])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON/JSONL dataset: {exc}") from exc
    if not samples:
        raise HTTPException(status_code=400, detail="Dataset must contain at least one sample.")
    normalized = [
        {
            "id": str(item.get("id", f"sample-{i + 1:04d}")),
            "prompt": str(item.get("prompt", "")),
            "target": str(item.get("target", item.get("answer", item.get("completion", "")))),
            "category": str(item.get("category", "uploaded")),
            "metadata": item.get("metadata", {}),
        }
        for i, item in enumerate(samples)
    ]
    dataset_id = f"ds_{uuid.uuid4().hex[:12]}"
    payload = {
        "dataset_id": dataset_id,
        "name": file.filename or "uploaded-dataset",
        "created_at": utc_now(),
        "real_or_simulated": "real_dataset",
        "samples": normalized,
        "summary": summarize_dataset(normalized),
    }
    write_json(DATASET_DIR / f"{dataset_id}.json", payload)
    return {k: v for k, v in payload.items() if k != "samples"} | {"preview": normalized[:10]}


@app.get("/api/lora/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    payload = read_json(DATASET_DIR / f"{dataset_id}.json")
    return {k: v for k, v in payload.items() if k != "samples"} | {"preview": payload["samples"][:25]}


@app.post("/api/lora/eval/baseline")
def baseline_eval(request: BaselineEvalRequest) -> dict[str, Any]:
    dataset = read_json(DATASET_DIR / f"{request.dataset_id}.json")
    result = score_samples(dataset["samples"], improvement=0.0)
    return {
        "eval_id": f"eval_{uuid.uuid4().hex[:12]}",
        "dataset_id": request.dataset_id,
        "model": request.model.model_dump(),
        "phase": "baseline",
        "real_or_simulated": "simulated",
        "metrics": result,
        "limitations": ["Baseline eval uses deterministic local scoring unless a real evaluator is wired in."],
    }


def job_path(job_id: str) -> Path:
    return JOB_DIR / f"{job_id}.json"


def load_job(job_id: str) -> dict[str, Any]:
    return read_json(job_path(job_id))


def save_job(job: dict[str, Any]) -> None:
    write_json(job_path(job["job_id"]), job)


def run_training_job(job_id: str) -> None:
    job = load_job(job_id)
    dataset = read_json(DATASET_DIR / f"{job['dataset_id']}.json")
    steps = int(job["config"]["steps"])
    logs = job["logs"]
    logs.append({"time": utc_now(), "level": "info", "message": "LoRA adapter job started."})
    job["status"] = "running"
    save_job(job)

    trace = []
    interval = max(1, steps // 20)
    for step in range(0, steps + 1):
        loss = max(0.08, 2.1 * math.exp(-0.035 * step) + 0.04 * math.sin(step / 3))
        reward = min(0.94, 0.46 + (step / max(steps, 1)) * 0.38)
        if step % interval == 0 or step == steps:
            point = {
                "step": step,
                "loss": round(loss, 4),
                "reward": round(reward, 4),
                "learning_rate": job["config"]["learning_rate"],
            }
            trace.append(point)
            logs.append({"time": utc_now(), "level": "metric", "message": f"step={step} loss={point['loss']} reward={point['reward']}"})
            job["progress"] = round(step / max(steps, 1), 4)
            job["trace"] = trace
            save_job(job)
            time.sleep(0.03)

    checkpoint_id = f"ckpt_{uuid.uuid4().hex[:12]}"
    checkpoint = {
        "checkpoint_id": checkpoint_id,
        "job_id": job_id,
        "adapter_name": job["config"]["adapter_name"],
        "path": str((EXPORT_DIR / checkpoint_id).resolve()),
        "real_or_simulated": job["real_or_simulated"],
        "metadata": {
            "rank": job["config"]["rank"],
            "alpha": job["config"]["alpha"],
            "dropout": job["config"]["dropout"],
            "trained_samples": len(dataset["samples"]),
            "base_model": job["model"],
        },
    }
    (EXPORT_DIR / checkpoint_id).mkdir(parents=True, exist_ok=True)
    write_json(EXPORT_DIR / checkpoint_id / "adapter_config.json", checkpoint["metadata"])
    write_json(EXPORT_DIR / checkpoint_id / "training_trace.json", {"trace": trace})

    job["status"] = "completed"
    job["progress"] = 1.0
    job["completed_at"] = utc_now()
    job["checkpoint"] = checkpoint
    job["metrics"] = {
        "final_loss": trace[-1]["loss"] if trace else None,
        "final_reward": trace[-1]["reward"] if trace else None,
        "estimated_trainable_params": job["config"]["rank"] * 524288,
    }
    logs.append({"time": utc_now(), "level": "info", "message": "LoRA adapter job completed."})
    save_job(job)


@app.post("/api/lora/train")
def train_adapter(request: TrainRequest, background_tasks: BackgroundTasks) -> dict[str, Any]:
    read_json(DATASET_DIR / f"{request.dataset_id}.json")
    real_ready = (
        request.model.source == "local_path"
        and bool(request.model.model_path)
        and Path(request.model.model_path).exists()
        and runtime_info()["real_lora_dependencies_available"]
    )
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    job = {
        "job_id": job_id,
        "dataset_id": request.dataset_id,
        "model": request.model.model_dump(),
        "status": "queued",
        "progress": 0.0,
        "created_at": utc_now(),
        "real_or_simulated": "real_capable_simulated_loop" if real_ready else "simulated",
        "config": request.model_dump(exclude={"model", "dataset_id"}) | {"steps": request.steps},
        "logs": [
            {
                "time": utc_now(),
                "level": "truth",
                "message": "This backend exports LoRA adapter artifacts only; base model weights are not exported.",
            }
        ],
        "trace": [],
        "limitations": [] if real_ready else ["Missing real training dependencies or local model path; running deterministic simulation."],
    }
    save_job(job)
    background_tasks.add_task(run_training_job, job_id)
    return {
        "job_id": job_id,
        "status": "queued",
        "real_or_simulated": job["real_or_simulated"],
        "status_url": f"/api/lora/jobs/{job_id}",
        "logs_url": f"/api/lora/jobs/{job_id}/logs",
    }


@app.get("/api/lora/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    job = load_job(job_id)
    return {k: v for k, v in job.items() if k != "logs"}


@app.get("/api/lora/jobs/{job_id}/logs")
def job_logs(job_id: str) -> dict[str, Any]:
    job = load_job(job_id)
    return {"job_id": job_id, "logs": job.get("logs", [])}


@app.post("/api/lora/eval/checkpoint")
def checkpoint_eval(request: CheckpointEvalRequest) -> dict[str, Any]:
    job = load_job(request.job_id)
    if job.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Training job is not complete.")
    dataset_id = request.dataset_id or job["dataset_id"]
    dataset = read_json(DATASET_DIR / f"{dataset_id}.json")
    result = score_samples(dataset["samples"], improvement=0.18)
    return {
        "eval_id": f"eval_{uuid.uuid4().hex[:12]}",
        "job_id": request.job_id,
        "checkpoint": job.get("checkpoint"),
        "phase": "checkpoint",
        "real_or_simulated": job["real_or_simulated"],
        "metrics": result,
        "baseline_delta_note": "Scores include deterministic simulated improvement unless real evaluator integration is added.",
    }


@app.post("/api/lora/exports")
def export_artifacts(request: ExportRequest) -> dict[str, Any]:
    job = load_job(request.job_id)
    if job.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Training job is not complete.")
    dataset = read_json(DATASET_DIR / f"{job['dataset_id']}.json")
    export_id = f"export_{uuid.uuid4().hex[:12]}"
    payload = {
        "export_id": export_id,
        "job_id": request.job_id,
        "created_at": utc_now(),
        "real_or_simulated": job["real_or_simulated"],
        "artifact_type": "lora_adapter_package",
        "not_base_model_weights": True,
        "adapter_config": job["checkpoint"]["metadata"],
        "training_metrics": job.get("metrics", {}),
        "training_trace": job.get("trace", []),
        "dataset_preview": dataset["samples"][:10] if request.include_dataset_preview else [],
        "limitations": [
            "Export contains adapter metadata and traces for the hackathon backend.",
            "Simulation exports are not trained model weights.",
        ],
    }
    write_json(EXPORT_DIR / f"{export_id}.json", payload)
    return payload


@app.get("/api/lora/exports")
def list_exports() -> dict[str, Any]:
    exports = [read_json(path) for path in EXPORT_DIR.glob("export_*.json")]
    return {"exports": sorted(exports, key=lambda item: item["created_at"], reverse=True)}


@app.get("/api/lora/exports/{export_id}")
def get_export(export_id: str) -> dict[str, Any]:
    return read_json(EXPORT_DIR / f"{export_id}.json")



# ==================================================================
#  Real LoRA Endpoints (uses lora_engine with real model)
# ==================================================================

@app.post("/api/lora/real/inference")
def real_lora_inference(request: dict[str, Any]) -> dict[str, Any]:
    """Run real model inference (base or LoRA patched)."""
    import sys
    sys.path.insert(0, str(ROOT))
    from lora_engine import get_engine, reset_engine

    prompts = request.get("prompts", [])
    mode = request.get("mode", "base")
    max_length = request.get("max_length", 60)

    if not prompts:
        raise HTTPException(status_code=400, detail="No prompts provided")

    try:
        engine = get_engine(request.get("model_name") or request.get("model_id"))
        if mode == "lora":
            results = engine.lora_inference(prompts, max_length)
        else:
            results = engine.base_inference(prompts, max_length)
        return {
            "results": results,
            "mode": mode,
            "model": engine.model_name,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Real inference failed: {exc}")


@app.post("/api/lora/real/report")
def real_lora_report() -> dict[str, Any]:
    """Generate a full report with real LoRA training and before/after comparison."""
    import sys, traceback
    sys.path.insert(0, str(ROOT))
    from lora_engine import get_engine, reset_engine

    try:
        # Reset engine to ensure clean state
        reset_engine()
        engine = get_engine("gpt2")
        dataset = synthetic_samples(24, "refusal-safety")
        report = engine.generate_comparison(dataset, max_length=40)
        return report
    except Exception as exc:
        tb = traceback.format_exc()
        print(f"REPORT ERROR: {exc}")
        print(tb)
        raise HTTPException(status_code=500, detail={
            "error": str(exc),
            "traceback": tb.split(chr(10))[-5:],
            "hint": "Try again - engine may need reinitialization"
        })


@app.post("/api/lora/real/train")
def real_lora_train(request: dict[str, Any]) -> dict[str, Any]:
    """Run real LoRA training."""
    import sys
    sys.path.insert(0, str(ROOT))
    from lora_engine import get_engine, reset_engine, LoRAEngine

    try:
        dataset_id = request.get("dataset_id", "")
        skip_base_inference = request.get("skip_base_inference", False)

        if dataset_id:
            dataset_data = read_json(DATASET_DIR / f"{dataset_id}.json")
            dataset = dataset_data.get("samples", [])
        else:
            # Create synthetic dataset
            dataset = synthetic_samples(request.get("count", 24), request.get("domain", "refusal-safety"))
        sample_count = request.get("sample_count")
        if isinstance(sample_count, int) and sample_count > 0:
            dataset = dataset[: min(sample_count, len(dataset))]

        rank = request.get("rank", 4)
        steps = request.get("steps", 20)
        model_name = request.get("model_name") or request.get("model_id") or "gpt2"

        engine = get_engine(model_name)

        # Run base inference first if requested
        base_results = None
        if not skip_base_inference:
            prompts = [s.get("prompt", "") for s in dataset]
            base_results = engine.base_inference(prompts, max_length=40)

        # Train LoRA
        metrics = engine.train_lora(dataset, rank=rank, steps=steps)

        # Run LoRA inference
        prompts = [s.get("prompt", "") for s in dataset]
        lora_results = engine.lora_inference(prompts, max_length=40)

        # Score
        passed = 0
        comparisons = []
        targets = [s.get("target", "") for s in dataset]
        for i in range(len(prompts)):
            br = base_results[i]["response"] if base_results and i < len(base_results) else ""
            lr = lora_results[i]["response"] if i < len(lora_results) else ""
            bs = engine._score_response(br, targets[i])
            ls = engine._score_response(lr, targets[i])
            p = ls > bs + 0.02
            if p:
                passed += 1
            comparisons.append({
                "prompt": prompts[i],
                "base_response": br,
                "lora_response": lr,
                "target": targets[i],
                "category": dataset[i].get("category", "general"),
                "passed": p,
                "base_score": round(bs, 4),
                "lora_score": round(ls, 4),
            })

        total = len(comparisons)
        avg_base = sum(c["base_score"] for c in comparisons) / max(total, 1)
        avg_lora = sum(c["lora_score"] for c in comparisons) / max(total, 1)

        return {
            "model": engine.model_name,
            "dataset_size": total,
            "training_metrics": metrics,
            "comparisons": comparisons,
            "summary": {
                "total": total,
                "passed": passed,
                "failed": total - passed,
                "pass_rate": round(passed / max(total, 1), 4),
                "avg_base_score": round(avg_base, 4),
                "avg_lora_score": round(avg_lora, 4),
                "improvement": round(avg_lora - avg_base, 4),
            },
            "failed_prompts": [c for c in comparisons if not c["passed"]],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Real LoRA training failed: {exc}")


@app.get("/api/lora/real/status")
def real_lora_status() -> dict[str, Any]:
    """Check if real LoRA model is available."""
    import sys
    sys.path.insert(0, str(ROOT))
    from lora_engine import MODEL_DIR, DEFAULT_MODEL

    model_path = resolve_cached_model_path(DEFAULT_MODEL) or (MODEL_DIR / DEFAULT_MODEL)
    available = model_path.exists() and ((model_path / "model.safetensors").exists() or (model_path / "pytorch_model.bin").exists())
    return {
        "available": available,
        "model": DEFAULT_MODEL,
        "model_path": str(model_path) if available else None,
        "gpu_available": __import__("torch").cuda.is_available(),
        "mode": "real_local_model" if available else "simulation",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
