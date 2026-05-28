# VPS Deployment

This repo is intended to run as one Docker Compose stack behind Caddy.

## VPS Requirements

- Ubuntu/Debian VPS with ports `80` and `443` open.
- Docker Engine with the Compose plugin.
- A DNS `A` record pointing your domain to the VPS public IP.

## First Deploy

```bash
git clone https://github.com/fountainnnnn/new-portfolio.git
cd new-portfolio
cp .env.example .env
nano .env
docker compose up -d --build
```

Set at least these values in `.env`:

```bash
SITE_DOMAIN=yourdomain.com
CADDY_EMAIL=you@example.com
PUBLIC_APP_URL=https://yourdomain.com
OPENAI_API_KEY=sk-...
SCHOOL_HDB_SECRET_KEY=change-me
SCHOOL_VEGGIE_SECRET_KEY=change-me
```

Caddy automatically requests and renews TLS certificates for `SITE_DOMAIN`.

## Update Deploy

```bash
cd new-portfolio
git pull
docker compose up -d --build
docker compose ps
```

## Health Checks

From the VPS:

```bash
curl -I http://localhost
curl -I https://yourdomain.com/projects
curl https://yourdomain.com/api/coding-quiz/healthz
curl https://yourdomain.com/api/file-chat-assistant/healthz
```

## Logs

```bash
docker compose logs -f caddy portfolio
docker compose logs -f coding-quiz file-chat-assistant mock-generator quiz-generator
```

## Notes

- Do not commit `.env`; it is ignored and should stay on the VPS.
- Public routes are extensionless, for example `/projects`, `/certificates`, and `/fed-ca2/achievements`.
- Old `.html` URLs redirect to clean URLs.
