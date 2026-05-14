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
  covid-cnn/
  agentlabs/

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
| `projects/covid-cnn` | `D:\SP Files\Personal Projects\Covid CNN\Covid-CNN` |
| `projects/agentlabs` | `D:\SP Files\Hackathons\AgentLabs` |

Generated folders, dependency folders, virtualenvs, model weights, caches, and local datasets are intentionally excluded from Git.

## Deploy Shape

This repo is intended to run on a VPS with Docker Compose and a reverse proxy such as Caddy.

```bash
docker compose up -d --build
```

Project-specific apps and services will be added after the existing repos are copied in.
