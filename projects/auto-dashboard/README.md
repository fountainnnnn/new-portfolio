# Decidr

> Turn data into decisions.

Decidr is a local full-stack MVP for turning uploaded CSV datasets into interactive analytics dashboards. Users upload a dataset, review an automatically generated profile, ask for a dashboard in natural language, and receive KPI cards, Plotly charts, and suggested insights they can edit live in the browser.

The backend uses FastAPI, Pandas, Plotly, and OpenAI when an API key is available. If `OPENAI_API_KEY` is not configured, Decidr falls back to a deterministic rule-based dashboard planner so the app still works locally.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Plotly via `react-plotly.js`
- Backend: FastAPI, Python, Pandas, Plotly, OpenAI API
- Storage: in-memory dictionaries for datasets and dashboards
- Auth: none for the MVP

## Project Structure

```text
.
├── backend
│   ├── app
│   │   ├── api
│   │   ├── core
│   │   ├── models
│   │   ├── services
│   │   └── utils
│   ├── tests
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── frontend
│   ├── app
│   ├── components
│   ├── lib
│   ├── public
│   └── types
├── .env.example
├── docker-compose.yml
└── README.md
```

## Environment

Copy `.env.example` to `.env` if you want OpenAI-powered planning:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.5
OPENAI_REASONING_EFFORT=high
FRONTEND_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

`OPENAI_API_KEY` is optional. Without it, the fallback planner generates charts from detected numeric, categorical, and datetime columns.

## Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend URL: `http://localhost:8000`

Useful checks:

```powershell
python -m pytest
```

## Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:3000`

Useful checks:

```powershell
npm run lint
npm run build
```

## Docker Compose

Docker Compose is included for convenience:

```powershell
docker compose up --build
```

The frontend runs on `http://localhost:3000` and the backend runs on `http://localhost:8000`.

## MVP Features

- CSV upload through FastAPI
- Pandas data profiling:
  - row and column counts
  - column names and inferred types
  - missing values
  - numeric summaries
  - categorical summaries
  - sample rows
  - detected date and metric columns
- OpenAI dashboard planning with strict JSON instructions
- Local fallback dashboard planner when no OpenAI key is present
- Plan validation against real dataset columns
- Plotly chart JSON generation
- Interactive chart rendering in the browser
- KPI cards and suggested insights
- ChatGPT-style SaaS layout with sidebar, prompt panel, and dashboard workspace

## API Endpoints

- `POST /upload`
- `GET /dataset/{dataset_id}/profile`
- `POST /dashboard/generate`
- `GET /dashboard/{dashboard_id}`
- `GET /health`

## Known Limitations

- Uploaded datasets and dashboards are stored in memory and reset when the backend restarts.
- CSV is the only supported upload format.
- There is no authentication, multi-user isolation, or persistent dashboard saving yet.
- Large datasets are profiled in-process; future versions should add file size limits, async jobs, and persistent storage.
- The OpenAI JSON response is validated and sanitized, but complex malformed plans fall back to rule-based generation.

## Future Improvements

- Database persistence for datasets, profiles, and dashboards
- User accounts and saved dashboard history
- Export to PDF, HTML, or embeddable dashboards
- Excel and multi-file uploads
- Natural-language chart editing
- Dashboard themes and layout customization
- Business templates for sales, finance, operations, marketing, and product analytics
- Background jobs for large datasets
- Stronger chart recommendation evaluation and insight generation
