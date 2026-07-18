## 1. System Architecture Overview
Target: New production-grade system in NextWork with clear bounded contexts, scalable real-time capabilities, and independent frontend/backend evolution.

1. Architectural style:
- Frontend: React Native + TypeScript, feature-sliced architecture.
- Backend: NestJS modular monolith first, service boundaries designed for future extraction.
- Data: PostgreSQL as source of truth, Redis for cache, distributed locks, pub/sub, and queue support.
- Real-time: Socket.IO with Redis adapter for horizontal scale.
- Async processing: Domain events + background workers for notifications/feed fan-out/index refresh.

2. Core bounded contexts:
- Identity and Access: auth, sessions, roles.
- User Graph: profiles, follows, blocks, relationships.
- Content: posts, comments, media references, feed ranking signals.
- Engagement: likes, reactions, counters.
- Messaging: conversations, participants, messages, read state.
- Notification: in-app notifications, delivery preferences, unread counters.

3. Dependency direction:
- API layer -> Application services -> Domain logic -> Repository interfaces -> Infrastructure adapters (Prisma/Redis/Socket providers).
- Cross-context interaction via events and explicit interfaces, never direct repository access between modules.

## 2. Frontend Architecture (React Native + TypeScript)
1. App structure:
- Feature-first modules: auth, feed, profile, social-graph, messaging, notifications, settings.
- Shared layer: design system, API client, typed contracts, utility hooks, storage, telemetry.

2. State strategy:
- Server state: TanStack Query for caching, pagination, retries, optimistic updates.
- Client/UI state: Zustand or Redux Toolkit for ephemeral state (composer draft, modal visibility, active conversation).
- Session: secure token storage (Keychain/Keystore via secure storage package).

3. Navigation:
- React Navigation with typed route params.
- Stacks: auth stack, main tab stack, nested messaging stack.

4. API integration:
- Single typed API SDK generated from OpenAPI spec from Nest backend.
- Request middleware for token refresh, idempotency keys, retry policies.

5. UI and performance:
- FlashList for large feed/message lists.
- Image caching and prefetch strategy.
- Feature flags for incremental rollout.

6. Testing:
- Unit tests for hooks and state.
- Integration tests for feature flows.
- E2E with Detox for critical paths (auth, post creation, message send/read).

## 3. Backend Architecture (NestJS)
1. Module map:
- AuthModule
- UsersModule
- ProfilesModule
- PostsModule
- FeedModule
- CommentsModule
- LikesModule
- FollowsModule
- MessagesModule
- NotificationsModule
- MediaModule
- RealtimeModule
- SearchModule (optional phase 2)
- CommonModule (guards, interceptors, error filters, config, logger)

2. Layering per module:
- Controller: HTTP or WS handlers.
- DTO: request/response contracts + validation.
- Service (application): use-cases and orchestration.
- Domain: entities/value objects/domain services.
- Repository interface: abstract data operations.
- Infra implementation: Prisma repositories, Redis cache adapters, Socket publishers.

3. Cross-cutting:
- JWT auth with rotating refresh tokens.
- RBAC plus ownership checks.
- OpenAPI docs by default.
- Centralized error model and problem-details responses.
- Observability: structured logs, request IDs, tracing hooks, metrics endpoints.

4. API pattern:
- REST for CRUD/read-heavy endpoints.
- Socket events for live chat, typing, read receipts, live notification badge updates.
- Event bus for side effects (notification fan-out, counter recalculation, feed updates).

## 4. Database Schema Design (PostgreSQL with Prisma)
1. Main relational tables:
- users: id, email, password_hash, status, created_at, updated_at.
- profiles: user_id (1:1), display_name, bio, avatar_url, metadata.
- posts: id, author_id, visibility, content, media_count, created_at, updated_at.
- post_media: id, post_id, media_url, type, width, height.
- comments: id, post_id, author_id, parent_comment_id (nullable), body, created_at.
- likes: id, user_id, post_id, created_at.
- follows: follower_id, followee_id, created_at.
- conversations: id, type (direct/group), created_by, created_at.
- conversation_participants: conversation_id, user_id, role, joined_at, last_read_message_id.
- messages: id, conversation_id, sender_id, body, message_type, created_at, edited_at.
- notifications: id, user_id, actor_id, type, entity_type, entity_id, is_read, created_at.
- notification_preferences: user_id, channels, mute_rules.
- device_tokens: id, user_id, platform, token, last_seen_at.

2. Relationships:
- users 1:1 profiles.
- users 1:N posts/comments/messages.
- posts 1:N comments and likes.
- users N:N users via follows.
- conversations N:N users via participants.
- conversations 1:N messages.
- users 1:N notifications.

3. Indexing strategy:
- posts: (created_at desc), (author_id, created_at desc).
- comments: (post_id, created_at asc).
- likes: unique (user_id, post_id), plus (post_id).
- follows: unique (follower_id, followee_id), plus reverse index (followee_id).
- messages: (conversation_id, created_at desc), partial index for unread scans.
- notifications: (user_id, is_read, created_at desc).
- participants: (user_id, conversation_id).

4. Scalability notes:
- Use UUIDv7 or ULID for sortable IDs.
- Partition very large tables later (messages, notifications) by time.
- Materialized counters (post_stats) updated asynchronously to avoid hot aggregates.

## 5. Real-Time Messaging Design
1. Transport:
- Socket.IO gateway in RealtimeModule.
- JWT auth on socket handshake.
- Rooms per conversation and per user.

2. Message lifecycle:
- Client emits send_message.
- Gateway validates membership -> service persists to PostgreSQL.
- After commit, publish domain event message.created.
- Redis pub/sub broadcasts to all app instances.
- Gateway emits message.new to room participants.
- Worker creates notification jobs for offline users.

3. Scale-out:
- Socket.IO Redis adapter for multi-instance fan-out.
- Sticky sessions at load balancer for connection stability.
- Redis streams or BullMQ for reliable async processing.
- Backpressure controls: rate limits, payload caps, server-side ACK timeouts.

4. Delivery guarantees:
- At-least-once event delivery semantics at transport layer.
- Idempotency key per client message to prevent duplicates.
- Read receipts persisted in conversation_participants last_read_message_id.

## 6. Repository Structure
1. infrastructure
- docker-compose (optional local stack)
- k8s or ecs manifests
- terraform (optional later)
- monitoring configs

2. documentation
- architecture decision records
- API conventions
- onboarding guide
- coding standards