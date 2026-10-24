# Verify

## Standard Checks
- Portfolio route smoke: `/` (200), `/projects` (200), `/certificates` (308 to `/projects#certs`), `/projects.html` and `/index.html` (308 to the clean URL), `/robots.txt`, `/sitemap.xml`, `/llms.txt`.
- Portfolio build: `npm run build` from `apps/portfolio-website`.
- Contact API: without `RESEND_API_KEY`, `POST /api/contact` returns 503 and the form shows the email fallback; with it, a test message arrives.
- Link check: every `href` and `img` on `/` and `/projects` returns 200 (LinkedIn returns 999 to bots, which is fine).
- Project page smoke: `/quiz-slide-generator/`, `/mock-paper-generator/`, `/file-chat-assistant/`, `/coding-quiz/`, `/auto-dashboard`.
- Auto Dashboard frontend: `npm run lint`, `npm run build`, `npm run test:e2e` from `projects/auto-dashboard/frontend`.
- Railway config: validate every `railway.json` file and build each service Dockerfile.
- Diff hygiene: `git diff --check`.
- Abuse controls: set a service rate env var to `2`, send three quick POSTs, and confirm the third response is `429`.

## UI Checks
- Home: the opening lines play for 8.4 s (skipped with a #hash), the name types, the detector draws its boxes, mini Mervin climbs out of the photo and lands beside it, and the five skill canvases animate.
- Mini Mervin: clicking him opens the chat (input focused); Contact me / Get in touch open the message form; scrolling closes either; he never stands on text at 1280 and 375 widths.
- Confirm no text/button overflow on mobile and desktop.
- Confirm `prefers-reduced-motion: reduce` leaves content visible and usable.
- Confirm GSAP/CDN failure does not hide page content.
- Confirm card hover/focus states are visible but not disruptive.
- Confirm static project forms, modals, chat widget, and upload controls remain usable.

## Notes
- `.omx/` contains local workflow/revert artifacts and is excluded from source control via `.git/info/exclude`.
