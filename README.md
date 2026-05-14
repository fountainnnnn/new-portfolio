# new-portfolio-host

One VPS-hosted repo for the portfolio frontends, backends, services, and deployment config.

## Layout

```txt
apps/
  # Frontend apps copied here.

services/
  # Backend/API/worker services copied here.

projects/
  # Local projects, demos, experiments, and source material copied here.

infra/
  # Reverse proxy and VPS configuration.
```

## Deploy Shape

This repo is intended to run on a VPS with Docker Compose and a reverse proxy such as Caddy.

```bash
docker compose up -d --build
```

Project-specific apps and services will be added after the existing repos are copied in.
