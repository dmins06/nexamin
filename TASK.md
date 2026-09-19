# StudyHubAI Build Plan

## Goal

Deliver a polished, responsive study dashboard that works entirely in the browser and demonstrates the core StudyHubAI learning workflow.

## Plan

1. Establish product and visual direction.
2. Scaffold React + TypeScript + Vite with linting and tests.
3. Build the responsive application shell and navigation.
4. Implement login, registration and searchable nationwide university selection.
5. Implement dashboard overview, weekly plan, focus timer, task completion, and study streaks.
6. Add local persistence, empty states, keyboard behavior, and reduced-motion support.
7. Add automated tests and documentation.
8. Run visual QA, lint, typecheck, tests, and production build; fix all failures.

## Definition of Done

- Complete Vietnamese login, registration, university selection, school-specific major selection and study dashboard on desktop and mobile.
- University catalog contains all 426 admissions institutions returned by the official MOET endpoint.
- All 426 institutions display a local image asset; verified official favicons are preferred and a code seal is used only when no official image is published.
- Registration offers the 6,783 public 2026 training programs available for 303 institutions and clearly handles institutions without a published list.
- Task completion, focus timer, and primary navigation work.
- User state survives reload through local storage.
- Empty and completed states are intentional and readable.
- `.env.example` contains no real secret.
- README documents setup, scripts, architecture, and usage.
- Lint, TypeScript, tests, and production build pass.
- Desktop and mobile renders are inspected for overflow and accessibility issues.
