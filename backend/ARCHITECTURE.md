# Nexamin Backend Architecture

## Shape

The backend is a modular monolith. HTTP routers validate transport data and call services. Services own transactions and policy. SQLAlchemy models and scoped query helpers own persistence. Infrastructure adapters isolate object storage, workers, and AI providers.

## Entities

- `University` has many users and courses.
- `User` owns courses, documents, conversations, quizzes, deadlines, events, activities, refresh tokens, and topic mastery.
- `Course` has topics, documents, conversations, quizzes, deadlines, events, and mastery rows.
- `Document` has chunks. Every retrieval query joins document ownership/course access before ranking.
- `Conversation` has messages.
- `Quiz` has questions and attempts; attempts have answers. Correct answers never appear in pre-submission schemas.
- `TopicMastery` is unique by user, course, and topic and is updated by deterministic scoring.

## API

All routes live under `/api/v1`: auth, universities, users, courses/topics, documents, conversations, AI chat, quizzes, progress, deadlines, calendar, and dashboard. `/health/live` and `/health/ready` support orchestration.

## Security Boundaries

- Short-lived JWT access tokens; opaque refresh tokens are hashed, rotated, and revocable.
- Ownership is part of repository SQL predicates for private resources.
- Upload type is determined from both signature and allowlisted extension; object keys are generated UUIDs.
- RAG retrieval is permission-scoped in SQL before results are returned or reranked.
- Secrets come only from environment variables. Sensitive tokens and document contents are excluded from logs.
