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

Project-specific apps and services will be added after the existing repos are copied in.
