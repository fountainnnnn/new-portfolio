# Product

## Status
- Draft source of truth for the public portfolio host.
- Last refreshed: 2026-05-27.

## Product Summary
This repository hosts Mervin Ng's public portfolio, project pages, certificates, and deployable project integrations. The site should help visitors quickly understand what Mervin builds, inspect selected AI/full-stack projects, and navigate into working demos without the portfolio feeling like a generic template.

## Primary Users
- Recruiters, hiring managers, and reviewers scanning proof of applied AI/full-stack work.
- Peers, mentors, and hackathon judges opening specific project demos.
- Mervin maintaining project proof, certificates, and deployment wiring.

## Primary Jobs
- Understand Mervin's positioning, skills, and location quickly.
- Browse selected work and learning projects with enough context to judge technical range.
- Open working project pages and demos from the portfolio.
- Inspect certificates without leaving the site unnecessarily.
- Contact Mervin or download the CV.

## Goals
- Keep the portfolio fast, clear, and deployable on a VPS.
- Make projects feel alive through purposeful interaction and motion, not decorative noise.
- Keep project demo backends reachable through same-origin portfolio routes.
- Preserve accessibility basics: keyboard navigation, readable text, reduced-motion support, and clear focus/hover states.

## Non-Goals
- Do not turn the portfolio into a marketing landing page with oversized filler sections.
- Do not hide project evidence behind heavy animations.
- Do not add account-connected publishing, hosted deploy workflows, or API-key flows without explicit approval.
- Do not make visual effects depend on fragile build tooling.

## Key Surfaces
- Home page: `apps/portfolio-website/index.html`.
- Project listing: `apps/portfolio-website/projects.html`.
- Certificates listing and modal: `apps/portfolio-website/certificates.html`.
- Static project pages: `quiz-slide-generator`, `mock-paper-generator`, `file-chat-assistant`, `coding-quiz`.
- Integrated Decidr Auto Dashboard route: `/auto-dashboard`.

## Success Signals
- Visitors can scan the page without waiting on effects.
- Project cards and CTAs clearly feel clickable.
- Animations reinforce hierarchy and state changes.
- Browser smoke tests, lint, build, and route checks stay green.
