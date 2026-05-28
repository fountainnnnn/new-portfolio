# Verify

## Standard Checks
- Portfolio route smoke: `http://localhost:3000/index.html`, `/projects.html`, `/certificates.html`.
- Project page smoke: `/quiz-slide-generator/`, `/mock-paper-generator/`, `/file-chat-assistant/`, `/coding-quiz/`, `/auto-dashboard`.
- Auto Dashboard frontend: `npm run lint`, `npm run build`, `npm run test:e2e` from `projects/auto-dashboard/frontend`.
- Docker syntax: `docker compose config --quiet`.
- Diff hygiene: `git diff --check`.
- Abuse controls: set a service rate env var to `2`, send three quick POSTs, and confirm the third response is `429`.

## UI Checks
- Confirm no text/button overflow on mobile and desktop.
- Confirm `prefers-reduced-motion: reduce` leaves content visible and usable.
- Confirm GSAP/CDN failure does not hide page content.
- Confirm card hover/focus states are visible but not disruptive.
- Confirm static project forms, modals, chat widget, and upload controls remain usable.

## Notes
- `.omx/` contains local workflow/revert artifacts and is excluded from source control via `.git/info/exclude`.
