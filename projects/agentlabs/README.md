# AgentLabs LoRA Lab

AgentLabs is a hackathon-focused LoRA training and adversarial evaluation workbench for local or open-weight language models.

The app is intentionally LoRA-only. It does not fine-tune OpenAI API models and does not export base model weights.

## Run

```powershell
.\run.bat
```

Or run the services manually:

```powershell
python -m pip install -r backend\requirements.txt
npm install
```

```powershell
npm run dev:backend
npm run dev
```

Frontend: `http://127.0.0.1:3000`
Backend: `http://127.0.0.1:8000`

## Backend Truth Modes

- `real_capable`: LoRA dependencies are present and a local/open-weight model path can be used.
- `simulation`: dependencies or model files are missing, so the backend runs deterministic Adapter Simulation Mode.

Every export includes:

- `real_or_simulated`
- `not_trained_on_openai_weights`
- limitations explaining what was actually produced

## Verify

```powershell
npm run lint
npm run build
python -m py_compile backend\main.py
```
