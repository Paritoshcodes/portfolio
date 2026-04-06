# Portfolio project — always-on rules

This is a single-page developer portfolio for Paritosh Singh (CS + Data Science, SRM Institute, batch 2027).

## Stack — never deviate

- HTML5 + CSS3 with custom properties — no CSS frameworks
- Vanilla JavaScript ES6 modules
- GSAP 3.12.5 + ScrollTrigger plugin from cdnjs.cloudflare.com
- Inter font from Google Fonts
- No React. No Vue. No Tailwind. No jQuery. No Bootstrap.

## Design tokens

- Background: #0d1117
- Surface: #161b22
- Primary text: #e6edf3
- Muted text: #7d8590
- Accent: #EF9F27 — one accent color, nothing else
- Glass card: rgba(255,255,255,0.05) bg, blur(12px), 1px solid rgba(255,255,255,0.08) border

## Animation rules

- All GSAP code inside window.addEventListener('load', function() { ... })
- ScrollTrigger.refresh() at end of load handler
- gsap.matchMedia() for responsive — all pins disabled below 768px
- prefers-reduced-motion: skip all animations, show content statically
- will-change: transform, opacity only on actively animated elements

## Output rules

- Always produce complete files — no partial snippets, no TODOs, no placeholder comments
- Follow the build sequence: HTML first, then CSS, then JS
- Every image tag has loading="lazy" except hero images which have loading="eager"
- All external links use target="_blank" rel="noopener noreferrer"
- Never hardcode color hex values inline — always use CSS custom properties