# Railway Deployment

This repository is a Railway monorepo. The public portfolio and each dynamic
project/API run as separate services in one Railway project and communicate
over Railway private networking.

## Where environment variables come from

Railway does **not** read the repository's `.env` or `.env.example` files.
Those files are only for local development.

Railway injects runtime variables from:

1. **Project Settings → Shared Variables** for values used by multiple services,
   such as `DEEPSEEK_API_KEY`.
2. Each service's **Variables** tab for its port, model, secret, and private
   service references.
3. Railway-provided variables such as `RAILWAY_PRIVATE_DOMAIN`.

Keep secrets in Railway, never in `railway.json` or committed files.

## Fix the existing portfolio service

The repository root is directly deployable. Keep the service Root Directory
empty (the repository root), remove any custom Build Command and Start Command,
and redeploy. The root `railway.json` selects the root `Dockerfile`, which only
copies and builds `apps/portfolio-website`.

Generate a public Railway domain or attach the custom domain only to this
portfolio service. The currently detected Node port is `8080`; set the custom
domain target to that detected port.

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

All three school services are built from this repository. The public portfolio
routes `/school-hdb-resale-ca1/` and `/school-veggie-ai-ca2/` proxy to their
private Railway services; the VeggieAI application reaches its CNN service over
the same private network.

## Portfolio service variables

Add these variables to the public portfolio service. Railway reference
variables keep the private domains synchronized with their services.

```env
PORT=8080
PUBLIC_APP_URL=https://ngyuhang.com
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
QUIZ_GENERATOR_API_URL=http://${{quiz-generator.RAILWAY_PRIVATE_DOMAIN}}:7860
MOCK_GENERATOR_API_URL=http://${{mock-generator.RAILWAY_PRIVATE_DOMAIN}}:7860
FILE_CHAT_ASSISTANT_API_URL=http://${{file-chat-assistant.RAILWAY_PRIVATE_DOMAIN}}:7860
CODING_QUIZ_API_URL=http://${{coding-quiz.RAILWAY_PRIVATE_DOMAIN}}:7860
AUTO_DASHBOARD_FRONTEND_URL=http://${{auto-dashboard-frontend.RAILWAY_PRIVATE_DOMAIN}}:8020
AUTO_DASHBOARD_API_URL=http://${{auto-dashboard-backend.RAILWAY_PRIVATE_DOMAIN}}:8000
SCHOOL_HDB_RESALE_URL=http://${{school-hdb-resale-ca1.RAILWAY_PRIVATE_DOMAIN}}:5000
SCHOOL_VEGGIE_AI_URL=http://${{school-veggie-ai-ca2.RAILWAY_PRIVATE_DOMAIN}}:5000
```

Create `DEEPSEEK_API_KEY` as a Shared Variable and share it with the portfolio,
the four API services, Auto Dashboard backend, HDB app, and VeggieAI app.

Create `DEEPSEEK_BASE_URL=https://api.deepseek.com` and
`DEEPSEEK_MODEL=deepseek-v4-flash` as Shared Variables too. The model has a
code default for both values, but shared variables keep every service explicit
and make future provider changes a single project-level edit.

Add these variables to `school-veggie-ai-ca2`:

```env
MODEL_INFERENCE_URL=http://${{school-veggie-ai-cnn.RAILWAY_PRIVATE_DOMAIN}}:8501
APP_BASE_PATH=/school-veggie-ai-ca2
```

And this one to `school-hdb-resale-ca1`:

```env
APP_BASE_PATH=/school-hdb-resale-ca1
```

The portfolio forwards `/school-…/` paths to these apps unchanged, so each app
must know its prefix. Without `APP_BASE_PATH` they serve only at `/` and every
proxied page is a Flask 404.

## Contact form

The home page's contact form posts to `/api/contact` on the portfolio service,
which sends the message with [Resend](https://resend.com). Add to the portfolio
service:

```env
RESEND_API_KEY=re_...
CONTACT_TO_EMAIL=spiralcrust@gmail.com
CONTACT_FROM_EMAIL=Mervin's Hub <hello@your-verified-domain>
```

Until `RESEND_API_KEY` is set, the form opens the visitor's email app with
their message filled in, addressed to `CONTACT_TO_EMAIL`. `CONTACT_FROM_EMAIL` must use a domain verified in
Resend; the default `onboarding@resend.dev` only delivers to the Resend
account's own email.

Set the school-project secrets on their respective services:

```env
SECRET_KEY=replace-with-a-long-random-value
```

The Auto Dashboard frontend image already builds with `/auto-dashboard` and
`/api/auto-dashboard` as its public base paths.
