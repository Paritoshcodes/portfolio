---
name: glassmorphism-ui
description: Implement correct, performant glassmorphism UI components. Use when building glass cards, frosted panels, overlays, or any translucent UI element with backdrop blur. Covers cross-browser compatibility, performance rules, and dark background requirements.
---

# Glassmorphism UI — correct implementation

## The four required CSS properties

All four must be present. Missing any one of them breaks the effect.

  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);

## Critical requirement

Glassmorphism is invisible on a flat solid background. The element sitting behind the glass card must be an image, a video, or a colorful surface. Without visual content behind it, blur has nothing to work with and the card just looks like a dark rectangle.

## Performance rules

- Never apply backdrop-filter to more than 4 or 5 elements simultaneously on screen
- Add will-change: transform to glass cards that animate — NOT will-change: backdrop-filter (very expensive)
- On mobile below 768px, remove backdrop-filter entirely to prevent frame drops on low-end devices

Mobile fallback:

  @media (max-width: 767px) {
    .glass-card {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      background: rgba(22, 27, 34, 0.95);
    }
  }

## Depth layering system

Use these three levels for visual hierarchy:

  Level 1 — background layer: rgba(255,255,255,0.03) — barely visible, behind content
  Level 2 — card layer: rgba(255,255,255,0.05) — main glass cards
  Level 3 — elevated layer: rgba(255,255,255,0.09) — modals, tooltips, active states

## Hover interaction

  .glass-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent);
    transform: translateY(-2px);
    transition: all 0.25s ease;
  }

## Full component example

  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-card);
    padding: 2rem 2.4rem;
    will-change: transform;
    transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
  }

  .glass-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent);
    transform: translateY(-2px);
  }