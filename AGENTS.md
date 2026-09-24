# Nexamin Development Rules

- Build a responsive, accessible Vietnamese-first study dashboard.
- Use React, TypeScript, and Vite.
- Keep feature code in `src/features`, shared UI in `src/components`, and utilities in `src/lib`.
- Keep domain types explicit; avoid `any` and unsafe assertions.
- Persist user-controlled state through a versioned local-storage adapter.
- Follow `DESIGN.md` and tokens in `src/styles/tokens.css`.
- All controls must be keyboard accessible with visible focus.
- Support 360px–1600px without horizontal overflow.
- Never use emoji as interface icons.
- Run lint, typecheck, tests, and build before completion.
- Keep secrets out of the repository and never modify files outside this project.
