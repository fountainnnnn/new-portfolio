# AGENTS.md

This file is the implementation contract for AgentLabs.

Product name: AgentLabs.
Product focus: LoRA training and adversarial evaluation for local or open-weight language models.
Product shape: a single-mode LoRA lab with a serious light-mode workbench, a live adversarial evaluation arena, and a backend-backed training/export pipeline.

If this file conflicts with older AgentForge or Agent Hardening code, this file wins.

## Non-Negotiable Rules

- Do not commit unless the user explicitly asks.
- Do not reintroduce Agent Hardening, wrapper hardening, API-agent upload, or agent export flows.
- Keep the app runnable without an OpenAI API key.
- Keep the app runnable without a local model, GPU, torch, transformers, peft, trl, or accelerate.
- Use clearly labeled simulation mode whenever real training dependencies or model files are unavailable.
- Never claim OpenAI API model weights are fine-tuned.
- Never claim simulated LoRA training is real training.
- Real training may only target local or open-weight Hugging Face compatible models.
- GGUF may be used or discussed for inference/export notes, but do not claim GGUF is directly LoRA-trained.
- Every run must expose structured logs.
- Every export must include metadata, limitations, and `real_or_simulated`.
- Every LoRA export must include `not_trained_on_openai_weights: true`.
- Missing dependencies must degrade gracefully.
- The main UI must use light mode and must not be a generic SaaS hero.
- Visible UI must not use emojis.

## Product Definition

AgentLabs helps users run an adversarial LoRA improvement loop:

1. Select a small local or open-weight base model, or use Demo Simulation Mode.
2. Load or generate training/evaluation cases.
3. Run a baseline adversarial evaluation.
4. Train a LoRA adapter when dependencies and model files are available.
5. Fall back to Adapter Simulation Mode when real training is unavailable.
6. Evaluate the resulting checkpoint.
7. Export adapter artifacts, model card, reward trace, evaluation report, and limitations.

## Required Routes

- `/`: AgentLabs LoRA workbench.
- `/rl-lab`: Alias to the same LoRA workbench.
- `/reports`: LoRA run summaries.
- `/exports`: LoRA artifact browser.

Removed routes and labels:

- No `/agent-hardening` product route.
- No Agentic AI Tool Hardening mode.
- No hardened wrapper export.
- No API-based agent upload.

## Backend Requirements

The backend should be FastAPI.

Required API surface:

- `GET /api/health`
- `GET /api/lora/capabilities`
- `POST /api/lora/datasets/demo`
- `POST /api/lora/datasets/upload`
- `POST /api/lora/baseline`
- `POST /api/lora/train`
- `GET /api/lora/jobs/{job_id}`
- `GET /api/lora/jobs/{job_id}/logs`
- `POST /api/lora/evaluate`
- `POST /api/lora/exports`

The backend must:

- Detect optional training dependencies at runtime.
- Report whether it is in Real Local Model Mode, Adapter Simulation Mode, or Demo Simulation Mode.
- Store job state and logs in a simple local artifact directory.
- Keep demo endpoints deterministic enough for a live hackathon demo.
- Run without GPU and without ML dependencies.

## Frontend Requirements

The UI must:

- Use AgentLabs branding everywhere.
- Present one LoRA-focused workbench, not a two-mode selector.
- Clearly show real vs simulated mode.
- Show baseline vs trained/checkpoint metrics.
- Show reward signals and penalties.
- Show training logs and export readiness.
- Keep the PixiJS arena only as adversarial model evaluation visualization.
- Avoid offscreen sprites, unreadable HUD text, and impossible attack counters.

## Verification

Before presenting completion:

- Run `npm run lint`.
- Run `npm run build`.
- Run a backend smoke test when backend files changed.
- If full real LoRA training cannot be run locally, say exactly why and verify the simulation path instead.
