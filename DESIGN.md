# Design

## Source of Truth
- Status: Draft
- Last refreshed: 2026-05-27
- Primary product surfaces: portfolio home, project listing, certificate listing, static project pages, Decidr proxy route.
- Evidence reviewed: `apps/portfolio-website/index.html`, `projects.html`, `certificates.html`, static project pages, `style.css`, `project-theme.css`, previous thumbnail/project integration work.

## Brand
- Personality: practical student-builder, warm, direct, applied, quietly polished.
- Trust signals: working demos, concrete project stacks, certificate previews, CV/contact access, deployable project routes.
- Avoid: generic purple/blue AI gradients, glassmorphism everywhere, floating decorative blobs, badge-heavy clutter, nested cards, bento filler, motion that slows scanning.

## Product Goals
- Goals: make the portfolio feel alive, make projects easy to inspect, keep deployment simple, preserve working demos.
- Non-goals: marketing-site theatrics, unrelated redesign, heavy animation dependencies beyond static CDN scripts.
- Success signals: clear hierarchy, responsive card grids, readable page motion, no text clipping, no broken routes.

## Personas and Jobs
- Primary personas: recruiters, technical reviewers, mentors, hackathon judges, peers.
- User jobs: scan skills, inspect proof of work, open demos, verify credentials, contact Mervin.
- Key contexts of use: desktop review, mobile browsing, VPS-hosted public domain, local development at `localhost:3000`.

## Information Architecture
- Primary navigation: About, Projects, Skills, Certifications, Contact.
- Core routes/screens: home sections, projects index, certificates index/modal, static project detail pages, Auto Dashboard route.
- Content hierarchy: identity first, selected work second, skills/certificates as supporting proof, contact at the end.

## Design Principles
- Motion must clarify structure: reveal hierarchy, clickability, state changes, and section transitions.
- Keep surfaces dense but calm: no card farms inside card farms, no decorative elements that compete with project previews.
- Preserve behavior before polish: animations cannot block form controls, file upload, chat, or proxy routes.
- Tradeoffs: subtle motion over spectacle; static robustness over framework-heavy animation systems.

## Visual Language
- Color: warm off-white base, dark ink/navy text, restrained blue accents, project-specific accent colors where already established.
- Typography: Nunito-forward, rounded but readable, no viewport-scaled font sizing.
- Spacing/layout rhythm: compact cards, generous page gutters, no overlapping text or cramped buttons.
- Shape/radius/elevation: moderate radii, shadows only for hierarchy and clickability.
- Motion: GSAP-powered reveal, stagger, hover lift, and light parallax; reduced-motion users get static content immediately.
- Imagery/iconography: actual project/certificate previews and Bootstrap/devicon icons; avoid abstract hero art.

## Components
- Existing components to reuse: navbar, project cards, stack chips, certificate cards, project hero previews, forms, FAQ accordions, chat widget.
- New/changed components: shared motion script and small motion CSS utilities only.
- Variants and states: hover, focus, modal open, scroll reveal, sticky/nav active, reduced motion.
- Token/component ownership: CSS remains in `style.css` and `project-theme.css`; JavaScript motion belongs in a shared static script.

## Accessibility
- Target standard: practical WCAG AA basics.
- Keyboard/focus behavior: preserve existing links, forms, accordions, modal, chat, and keyboard scroll controls.
- Contrast/readability: no low-contrast decorative overlays over text.
- Screen-reader semantics: motion scripts must not add meaningful content that screen readers miss.
- Reduced motion and sensory considerations: honor `prefers-reduced-motion: reduce` and avoid continuous looping motion.

## Responsive Behavior
- Supported breakpoints/devices: mobile, tablet, desktop, wide desktop.
- Layout adaptations: cards collapse to one column on small screens; project pages stack previews above/below hero copy as existing CSS dictates.
- Touch/hover differences: hover-only effects must degrade cleanly on touch.

## Interaction States
- Loading: existing project loaders remain primary.
- Empty: existing blank project/chat states remain.
- Error: existing alerts remain visible and not animated away.
- Success: success/download states can enter with a short reveal.
- Disabled: disabled buttons remain visually clear and non-interactive.
- Offline/slow network: static content remains readable without GSAP CDN.

## Content Voice
- Tone: plain, student-builder, specific, no hype.
- Terminology: use concrete project names and stacks.
- Microcopy rules: keep labels short; do not add explanatory UI text about animations.

## Implementation Constraints
- Framework/styling system: static HTML/CSS/JS plus Bootstrap; Decidr uses Next separately.
- Design-token constraints: extend existing CSS variables/patterns; do not introduce a design-system framework.
- Performance constraints: small shared script, no animation work when reduced motion is enabled, no layout-thrashing loops.
- Compatibility constraints: pages must still work if CDN scripts fail.
- Test/screenshot expectations: run lint/build where available, browser smoke main routes, and design-lint/visual proof when feasible.

## Open Questions
- [ ] Whether the site should keep the long opening intro on home after adding GSAP page motion.
- [ ] Whether Decidr's Next UI should receive its own separate motion system later.
