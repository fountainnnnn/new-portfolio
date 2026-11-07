# Verify

## Standard Checks
- Portfolio route smoke: `/` (200), `/projects` (200), `/certificates` (308 to `/projects#certs`), `/projects.html` and `/index.html` (308 to the clean URL), `/robots.txt`, `/sitemap.xml`, `/llms.txt`.
- Portfolio build: `npm run build` from `apps/portfolio-website`.
- Contact API: without `RESEND_API_KEY`, `POST /api/contact` returns `{ ok: false, fallback: "email" }` and the form opens a prefilled email; with it, a test message arrives.
- Link check: every `href` and `img` on `/` and `/projects` returns 200 (LinkedIn returns 999 to bots, which is fine).
- Project page smoke: `/quiz-slide-generator/`, `/mock-paper-generator/`, `/file-chat-assistant/`, `/coding-quiz/`, `/auto-dashboard`.
- Auto Dashboard frontend: `npm run lint`, `npm run build`, `npm run test:e2e` from `projects/auto-dashboard/frontend`.
- Railway config: validate every `railway.json` file and build each service Dockerfile.
- Diff hygiene: `git diff --check`.
- Abuse controls: set a service rate env var to `2`, send three quick POSTs, and confirm the third response is `429`.

## UI Checks
- Home: the three opening lines play, then mini Mervin jumps in, says "Meet my crew.", the five cursors burst out of his laptop and line up above his bubble ("Okay crew, let's build it!"); the opening ends at 12.8 s (skipped with a #hash or a reload in the same tab), the name types, the detector draws its boxes, he jumps to his hero spot, and the five skill canvases animate.
- Crew build: scrolling down, the nearest free cursor builds each section as it enters (wipe, drop or pop, with its name chip); a fast flick leaves nothing blank after about a second, and content already scrolled past shows at once. On a phone (600 px and under) idle cursors fly back into his laptop.
- Crew lines: his bubble follows the crew script (photo "Hi! I'm mini Mervin." through "All built. Let's talk!") and he still never stands on text.
- Reload skip: reloading in the same tab (or opening a #hash) skips the opening lines; he is at his hero spot and the crew pops out of him. A new tab plays the opening again, and visiting `/projects` or a tool page first does not count as having seen it. About 3 s after the finish jump, still near the top, he says "Scroll down, I'll show you around." (not after a no-intro start).
- No blank content lingering: a few seconds after scrolling stops, every `[data-crew]` target on screen has `.crew-done`; with `html.crew-on` removed (reduced motion, or a crew error logged as `[crew] stopped, page revealed`) every section is visible.
- Mini Mervin: clicking him opens the chat (input focused); Contact me / Get in touch open the message form; scrolling closes either; he never stands on text at 1280 and 375 widths; right after the opening he takes clicks again (the crew only holds him click-through for the opening and the finish jump).
- Confirm no text/button overflow on mobile and desktop.
- Confirm `prefers-reduced-motion: reduce` leaves content visible and usable: no crew, no `html.crew-on`, no hidden targets, and mini Mervin, the chat and the intro behave as before the crew.
- Confirm GSAP/CDN failure does not hide page content.
- Confirm card hover/focus states are visible but not disruptive.
- Confirm static project forms, modals, chat widget, and upload controls remain usable.

## Notes
- `.omx/` contains local workflow/revert artifacts and is excluded from source control via `.git/info/exclude`.
