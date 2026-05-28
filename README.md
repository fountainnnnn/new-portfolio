# new-portfolio-host

One VPS-hosted repo for the portfolio frontends, backends, services, and deployment config.

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

infra/
  # Reverse proxy and VPS configuration.
```

## Imported Sources

| Destination | Source |
| --- | --- |
| `apps/portfolio-website` | `D:\SP Files\Personal Projects\portfolio-website` |
| `services/coding-quiz` | `D:\SP Files\Personal Projects\backend-apis\coding-quiz` |
| `services/file-chat-assistant` | `D:\SP Files\Personal Projects\backend-apis\file-chat-assistant` |
| `services/mock-generator` | `D:\SP Files\Personal Projects\backend-apis\mock-generator` |
| `services/quiz-generator` | `D:\SP Files\Personal Projects\backend-apis\quiz-generator` |
| `projects/auto-dashboard` | `D:\SP Files\Personal Projects\auto-dashboard` |

Generated folders, dependency folders, virtualenvs, model weights, caches, and local datasets are intentionally excluded from Git.

## Link-Only Projects

These are shown on the portfolio projects page but are not copied into this repo.

| Project | Link |
| --- | --- |
| Covid CNN | `https://github.com/fountainnnnn/Covid-CNN` |
| AgentLabs LoRA Lab | `https://github.com/fountainnnnn/AgentLabs` |

## Deploy Shape

This repo is intended to run on a VPS with Docker Compose and a reverse proxy such as Caddy.

```bash
docker compose up -d --build
```

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

For VPS deployment, set `SITE_DOMAIN`, `PUBLIC_APP_URL`, and `OPENAI_API_KEY`
in `.env`, then run:

```bash
docker compose up -d --build
```
