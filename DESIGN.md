# Design

## Source of Truth
- Status: Current
- Last refreshed: 2026-11-08
- Primary product surfaces: home (`/`), projects and certificates (`/projects`), the four AI demo tools, the Decidr proxy route.
- Code: `apps/portfolio-website/src` (React + Vite). Each section is a component in `src/components` with its own stylesheet in `src/styles`; content lives in `src/data`.

## Brand
- Personality: practical student-builder, warm, direct, quietly crafted. The site reads like an engraving on paper.
- Name: Mervin's Hub. Title under the name: Full-stack AI Developer / Data Scientist.
- Avoid: purple/blue AI gradients, glassmorphism, decorative blobs, badge clutter, AI-generated thumbnails, pulsing "live" dots, em dashes in copy.

## Visual Language
- Color: warm paper `#f4f2ec` with ink `#1d1b18`; one accent blue `#0071e3` for active states; a dark ink footer and bronze for the NOAI card. Tokens are in `src/styles/base.css`.
- Typography: Apple system fonts. New York (serif) for display and headings, SF Pro for UI and body, SF Mono for the detector labels. No webfonts.
- Imagery: real screenshots of each project (never generated covers), real certificates, my actual photo, monochrome Simple Icons for issuers.
- Motion: the agent crew (Web Animations API, never `transform`) builds each section as it scrolls in; GSAP (npm) for the detector, the about lead, tile parallax, the footer curve and, if the crew cannot start, the old scroll reveals; canvas visuals run only while on screen; everything respects `prefers-reduced-motion` (no crew, nothing hidden).

## Key Pieces
- Opening intro: the previous site's three lines, then a fourth screen where mini Mervin jumps in, says "Meet my crew." and brings five cursor agents out of his laptop (~12.8 s in all); skipped by a #hash or by a reload in the same tab.
- Hero: typed name, role, location, Download CV and Contact me, plus my photo with live object-detection boxes and a typed vision-model caption.
- What I can build: five skills (agents, machine learning, computer vision, agentic RAG, full-stack apps), each with a live canvas (`src/visuals`) and a "Built in" row linking the projects that show it.
- Mini Mervin (`src/mascot`): a cartoon of me who runs to empty space near the middle of the screen, introduces each section, and never covers text. He coordinates five cursor agents (`crew.js`: layout, type, media, ui, qa) that build each section as it scrolls in; on phones they go back into his laptop when idle. Clicking him opens a small chat (agent loop: look, think, check, act); Contact me / Get in touch open a message form in the same window.
- Selected work: top three projects plus an "All projects" tile; the first two flip through real pages on hover.
- Competitions lead with the NOAI 2026 bronze; certifications show four real certificate previews.

## Accessibility
- Practical WCAG AA basics; visible focus rings; dialogs for full-size certificates; reduced motion shows everything static.
- Touch screens: no sticky hover states; the mascot's chat and bubble stay inside the screen.

## Responsive Behavior
- Breakpoints at 960 px (single column, smaller mascot) and 600 px (phone hero fits one screen, photo first).
- No horizontal scroll at any width.

## Implementation Constraints
- Home and projects load only their own CSS chunks; the demo tools load Bootstrap and the old `style.css` themselves, so the two systems never mix.
- Static assets live in `apps/portfolio-website/img` and are served as-is.
