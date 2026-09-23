---
version: 1
slug: "src-features-social-socialviews-tsx"
primary_target: "src/features/social/SocialViews.tsx"
related_targets: ["src/styles/social.css","backend/app/api/v1/social.py"]
---

SCOPE
- Target: src/features/social/SocialViews.tsx community surface and its backend social feed API.
- Mode: Operate.
- Preserve the existing Learning Observatory identity, application shell, authentication, friendships and direct messages.

AUDIENCE AND JOB
- Vietnamese university students sharing study progress, useful images and short status updates.
- Primary job: publish, discover, react and continue a useful academic conversation without leaving StudyHubAI.

TASKS AND ACTIONS
- Compose a text or image post and choose public, friends-only or private visibility.
- Browse a persisted feed; like, comment and repost.
- Search people by name, open a social profile and see posts visible to the viewer.
- Move from a profile to friend actions or messaging through existing relationships.

CONTENT AND PROOF
- All posts, images, reactions, comments, reposts, counts and profile summaries come from the backend database.
- Empty, loading, success and failure states must be honest; no seeded social proof or invented trends.

DIRECTION AND MEMORABLE MOMENT
- A focused three-column social workspace on desktop: identity/search rail, generous central feed, contextual relationship rail.
- On mobile the feed becomes the first-class single column; search and profile context collapse into compact controls.
- Signature interaction: the composer expands through real content states, then the new post settles instantly at the top of the feed.

CONSTRAINTS
- Vietnamese-first, WCAG keyboard/focus support, 360–1600px with no horizontal overflow.
- Use existing tokens, Lucide icons and dark observatory surfaces; no emoji, fake metrics or decorative motion.
- Privacy must be enforced by the backend, not only hidden in the UI.
- Seed key: user-directed-community-social-network.
- Unresolved decisions: none; the request explicitly requires the familiar social-network interaction model.
