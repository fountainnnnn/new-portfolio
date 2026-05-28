# VeggieAI (CA2)

Flask web app for classifying vegetable images with a profile + prediction history stored in SQLite.

## Quick start

```bash
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000/`.

## Environment (.env)

- This repo uses `.env` for local development. It is ignored by git (`.gitignore`).
- A starter file is provided at `.env.example`.
- A ready-to-run local `.env` is also included (keep secrets out of git).

### Google Sign-In (local now, Render later)

1. In Google Cloud Console (OAuth client: Web), add redirect URI:
   - `http://127.0.0.1:5000/auth/google/callback`
   - `http://localhost:5000/auth/google/callback`
2. Ensure these env vars exist in `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. Run the app and use the "Continue with Google" button on `/login`.

Notes:
- The redirect URI must match exactly (including `localhost` vs `127.0.0.1`).
- If your OAuth consent screen is in "Testing", add your Google account under "Test users".

For Render later, add another redirect URI:
- `https://<your-render-domain>/auth/google/callback`

And set Render env vars:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TRUST_PROXY_HEADERS=true`

### OpenAI Chatbot (local)

1. Create an OpenAI API key.
2. Add this env var to `.env`:
   - `OPENAI_API_KEY`
3. Optional env vars:
   - `OPENAI_MODEL` (default: `gpt-4o-mini`)
   - `OPENAI_CHAT_SYSTEM_PROMPT`
4. Start the app and open `http://127.0.0.1:5000/chat`.

Security notes:
- Do not commit API keys. Keep them only in `.env` / Render env vars.
- If a key was ever pasted into chat, screenshots, or pushed to git, rotate it immediately.

### Model inference (deployed CNN)

The chat page supports uploading an image for prediction. The Flask backend calls a deployed TensorFlow Serving endpoint.

- Optional env var:
  - `MODEL_INFERENCE_URL` (base URL, default: `https://ca2-cnn-tfserving.onrender.com`)

## Database (SQLite)

- DB file: `application/database.db` (auto-created on app startup).
- Tables:
  - `users` (profile + login credentials)
  - `prediction_history` (prediction metadata + uploaded image bytes)

### What is stored

- **Profile info**: `username`, `email`, `full_name` (+ optional `phone`, `location`, `preferred_model`)
- **Prediction history**: `model`, `label`, `confidence`, `top_k`, `metrics`, `compare`, timestamp
- **Images**: stored directly in SQLite as a BLOB (`prediction_history.image_bytes`) with MIME type + filename

### APIs used by the frontend

- `POST /api/predictions` (multipart `entry` JSON + `image` file)
- `GET /api/predictions?limit=...`
- `DELETE /api/predictions` (clear)
- `GET /api/predictions/<id>/image`
