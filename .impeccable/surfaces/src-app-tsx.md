---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

## Intent
Nexamin is a Vietnamese-first study command center that helps students see today’s schedule, academic progress, goals, and reach Emin AI without losing context. It should feel calm, premium, spatial, and grounded in real study data.

## Content
Lead with a compact greeting and global search. The dashboard shows four live academic statistics, today’s schedule, Emin AI shortcuts, real learning progress, and upcoming study goals. Navigation preserves all existing product capabilities and uses Nexamin branding only.

## Visual system
One product, two connected environments: dark mode observes Earth from orbit using deep navy, luminous blue atmosphere, stars and restrained cyan-violet glass; light mode descends to the Earth’s surface with blue sky, layered clouds, sunlight and green terrain behind translucent white glass. Typography is Manrope and Space Grotesk. Cards use consistent 18–24px radii, fine borders, layered blur, and strong contrast.

## Interaction
Desktop uses a fixed sidebar and compact command header. Hover states lift by only a few pixels; route transitions are soft. Background layers use restrained pointer parallax and slow drift on capable desktop devices. Theme changes cross-fade. Every control is keyboard accessible and all motion is removed or reduced under prefers-reduced-motion.

## Responsive
Desktop uses a two-column shell of sidebar plus content, with the dashboard arranging schedule and AI, then progress and goals. Tablet collapses the sidebar and grids. Mobile uses a bottom navigation, single-column cards, touch targets of at least 44px, no horizontal overflow, and reduced background detail for performance.

## Guardrails
Reuse existing React components, APIs, and business logic. Do not fabricate metrics or progress. Keep Nexamin and Emin AI naming consistent. Do not use emoji icons, excessive glow, illegible glass, huge titles, or decorative elements that obscure content.
