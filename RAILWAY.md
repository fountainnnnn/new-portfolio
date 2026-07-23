# Railway Deployment

This repository is a Railway monorepo. The public portfolio and each dynamic
project/API run as separate services in one Railway project and communicate
over Railway private networking.

## Fix the existing portfolio service

The repository root is directly deployable. Keep the service Root Directory
empty (the repository root), remove any custom Build Command and Start Command,
and redeploy. The root `railway.json` selects the root `Dockerfile`, which only
copies and builds `apps/portfolio-website`.

Generate a public Railway domain or attach the custom domain only to this
portfolio service.

## Add the project services

Create one Railway service from this same GitHub repository for every row.
Set both the Root Directory and Config File Path shown below. Do not set custom
build or start commands.

| Railway service name | Root Directory | Config File Path | Internal port |
| --- | --- | --- | ---: |
| `quiz-generator` | `/services/quiz-generator` | `/services/quiz-generator/railway.json` | 7860 |
| `mock-generator` | `/services/mock-generator` | `/services/mock-generator/railway.json` | 7860 |
| `file-chat-assistant` | `/services/file-chat-assistant` | `/services/file-chat-assistant/railway.json` | 7860 |
| `coding-quiz` | `/services/coding-quiz` | `/services/coding-quiz/railway.json` | 7860 |
| `auto-dashboard-frontend` | `/projects/auto-dashboard/frontend` | `/projects/auto-dashboard/frontend/railway.json` | 8020 |
| `auto-dashboard-backend` | `/projects/auto-dashboard/backend` | `/projects/auto-dashboard/backend/railway.json` | 8000 |
| `school-hdb-resale-ca1` | `/projects/school-hdb-resale-ca1` | `/projects/school-hdb-resale-ca1/railway.json` | 5000 |
| `school-veggie-ai-ca2` | `/projects/school-veggie-ai-ca2` | `/projects/school-veggie-ai-ca2/railway.json` | 5000 |
| `school-veggie-ai-cnn` | `/projects/school-veggie-ai-cnn` | `/projects/school-veggie-ai-cnn/railway.json` | 8501 |

Set a `PORT` variable matching the Internal port column on every project
service. These services should stay private; they do not need public domains.

## Portfolio service variables

Add these variables to the public portfolio service. Railway reference
variables keep the private domains synchronized with their services.

```env
QUIZ_GENERATOR_API_URL=http://${{quiz-generator.RAILWAY_PRIVATE_DOMAIN}}:7860
MOCK_GENERATOR_API_URL=http://${{mock-generator.RAILWAY_PRIVATE_DOMAIN}}:7860
FILE_CHAT_ASSISTANT_API_URL=http://${{file-chat-assistant.RAILWAY_PRIVATE_DOMAIN}}:7860
CODING_QUIZ_API_URL=http://${{coding-quiz.RAILWAY_PRIVATE_DOMAIN}}:7860
AUTO_DASHBOARD_FRONTEND_URL=http://${{auto-dashboard-frontend.RAILWAY_PRIVATE_DOMAIN}}:8020
AUTO_DASHBOARD_API_URL=http://${{auto-dashboard-backend.RAILWAY_PRIVATE_DOMAIN}}:8000
SCHOOL_HDB_RESALE_URL=http://${{school-hdb-resale-ca1.RAILWAY_PRIVATE_DOMAIN}}:5000
SCHOOL_VEGGIE_AI_URL=http://${{school-veggie-ai-ca2.RAILWAY_PRIVATE_DOMAIN}}:5000
```

Also add `OPENAI_API_KEY` and any model/rate-limit settings required by the
portfolio. Share `OPENAI_API_KEY` with the API services that call OpenAI.

Add this variable to `school-veggie-ai-ca2`:

```env
MODEL_INFERENCE_URL=http://${{school-veggie-ai-cnn.RAILWAY_PRIVATE_DOMAIN}}:8501
```

Set the school-project secrets on their respective services:

```env
SECRET_KEY=replace-with-a-long-random-value
```

The Auto Dashboard frontend image already builds with `/auto-dashboard` and
`/api/auto-dashboard` as its public base paths.
