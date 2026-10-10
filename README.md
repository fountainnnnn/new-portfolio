# new-portfolio-host

One Railway-hosted monorepo for the portfolio, project frontends, APIs, and
school-project applications.

## Layout

```txt
apps/
  portfolio-website/

services/
  coding-quiz/
  file-chat-assistant/
  mock-generator/
  quiz-generator/

projects/
  auto-dashboard/
  school-hdb-resale-ca1/
  school-veggie-ai-ca2/
  school-veggie-ai-cnn/
```

## Origins

The portfolio site and the four AI demo services started as standalone projects and were consolidated here so they deploy together on Railway. The original repos for the services are still public:

| Service | Original repo |
| --- | --- |
| `services/quiz-generator` | [quiz-slides-generator](https://github.com/fountainnnnn/quiz-slides-generator) |
| `services/mock-generator` | [Mock-Paper-Generator](https://github.com/fountainnnnn/Mock-Paper-Generator) |
| `services/file-chat-assistant` | [file-chat-assistant](https://github.com/fountainnnnn/file-chat-assistant) |
| `services/coding-quiz` | [coding-quiz-webapp](https://github.com/fountainnnnn/coding-quiz-webapp) |

Generated folders, dependency folders, virtualenvs, model weights, caches, and local datasets are intentionally excluded from Git.

## Link-Only Projects

These are shown on the portfolio projects page but are not copied into this repo.

| Project | Link |
| --- | --- |
| Covid CNN | `https://github.com/fountainnnnn/Covid-CNN` |
| AgentLabs LoRA Lab | `https://github.com/fountainnnnn/AgentLabs` |

## Railway deployment

The repository root deploys the public portfolio directly. Each dynamic
project/API is a separate private Railway service built from this same
repository. See
[RAILWAY.md](RAILWAY.md) for the exact service roots, config paths, ports, and
reference variables.

The portfolio server is the public entry point. It serves the static portfolio,
proxies project APIs under `/api/...`, and proxies Decidr Auto Dashboard under
`/auto-dashboard`.

## Local Service Ports

The portfolio app uses same-origin routes and proxies them to local FastAPI services:

| Website route | Local service |
| --- | --- |
| `/api/quiz-slide-generator/*` | `http://127.0.0.1:8011/*` |
| `/api/mock-paper-generator/*` | `http://127.0.0.1:8012/*` |
| `/api/file-chat-assistant/*` | `http://127.0.0.1:8013/*` |
| `/api/coding-quiz/*` | `http://127.0.0.1:8014/*` |
| `/api/auto-dashboard/*` | `http://127.0.0.1:8021/*` |
| `/auto-dashboard/*` | `http://127.0.0.1:8020/auto-dashboard/*` |
| `/school-hdb-resale-ca1/*` | `http://127.0.0.1:8031/school-hdb-resale-ca1/*` |
| `/school-veggie-ai-ca2/*` | `http://127.0.0.1:8032/school-veggie-ai-ca2/*` |

All other school-project viewers and artifacts are static files shipped inside
`apps/portfolio-website`, so they are hosted directly by the public portfolio
service without external links.

## Decidr Auto Dashboard

The portfolio project card opens `/auto-dashboard`, which is the existing
Next.js Decidr frontend. Its browser API calls use `/api/auto-dashboard`, and
the portfolio server strips that prefix before proxying to the existing FastAPI
backend.

Local ports:

| Service | Port |
| --- | --- |
| Portfolio server | `3000` |
| Decidr frontend | `8020` |
| Decidr backend | `8021` |

The checked-in `.env.example` is for local development only. Railway reads
runtime settings from each service's **Variables** tab and project-level
**Shared Variables**; it does not import the repository's `.env` files.
