| ID | Priority | Feature | Status | Owner | Backend API scope (modules) | Mobile UI scope (src) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| P0-001 | Must | Share post | Complete | Backend lead + Mobile lead | backend-api/src/modules/posts, backend-api/src/modules/feed, backend-api/src/modules/notifications | mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/features/feed/screens/PostDetailScreen.tsx | User can share a post from feed and post detail; share target includes stable post reference; receiving user can open the shared post; analytics event is logged. |
| P0-002 | Must | Send thanks | Complete | Backend lead + Mobile lead | backend-api/src/modules/notifications, backend-api/src/modules/profiles, backend-api/src/modules/messages | mobile-app/src/features/profile/screens/ProfileViewScreen.tsx, mobile-app/src/features/notifications/screens/NotificationsScreen.tsx | On another user profile, sender can trigger Send Thanks; receiver gets a thanks notification; duplicate spam controls apply; muted users do not receive thanks notifications. |
| P0-003 | Must | Tag people in post | Complete | Backend lead + Mobile lead | backend-api/src/modules/posts, backend-api/src/modules/search, backend-api/src/modules/notifications | mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/features/feed/screens/PostDetailScreen.tsx, mobile-app/src/features/search/SearchScreen.tsx | Composer supports tagging users; tagged users persist on post; tagged users get notifications; tagged users are searchable from post detail and search results. |
| P0-004 | Must | Poll post create and vote | Complete | Backend lead + Mobile lead | backend-api/src/modules/posts, backend-api/src/modules/feed, backend-api/src/modules/notifications | mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/features/feed/screens/PostDetailScreen.tsx | User can create poll with multiple options; users can vote once (or change vote if policy allows); results update consistently in feed/detail; poll state survives refresh. |
| P0-005 | Must | Post edit | Complete | Backend lead + Mobile lead | backend-api/src/modules/posts | mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/features/feed/screens/PostDetailScreen.tsx | Author can edit own post content; non-author cannot edit; updated content appears in feed/detail without stale cache. |
| P0-006 | Must | Post delete | Complete | Backend lead + Mobile lead | backend-api/src/modules/posts, backend-api/src/modules/feed | mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/features/feed/screens/PostDetailScreen.tsx | Author or authorized admin can delete post; deleted post is removed from feed/detail/search; engagement counts and cache are reconciled. |
| P0-007 | Must | Auth recovery: forgot password and reset | Complete | Backend lead + Mobile lead | backend-api/src/modules/auth, backend-api/src/modules/users | mobile-app/src/features/auth/AuthScreen.tsx | User can request password reset; token/OTP validation works; user can set new password and log in; invalid or expired reset token is rejected with clear error. |
| P0-008 | Must | Auth recovery: email verification | Complete | Backend lead + Mobile lead | backend-api/src/modules/auth | mobile-app/src/features/auth/AuthScreen.tsx | New account verification state is tracked; unverified restrictions are enforced by policy; resend verification supported; verified state persists across sessions. |
| P0-009 | Must | Organization edit | Complete | Backend lead + Mobile lead | backend-api/src/modules/organizations | mobile-app/src/features/groups/GroupsScreen.tsx, mobile-app/src/features/profile/screens/ProfileViewScreen.tsx | Owner/admin can edit organization fields allowed by policy; members can view updated values immediately; unauthorized roles are blocked. |
| P0-010 | Must | Organization delete/deactivate | Complete | Backend lead + Mobile lead | backend-api/src/modules/organizations, backend-api/src/modules/groups, backend-api/src/modules/posts, backend-api/src/modules/messages | mobile-app/src/features/groups/GroupsScreen.tsx | Owner can deactivate/delete organization through protected flow; confirmation and safeguards exist; members lose access according to policy; data retention rule is applied. |
| P0-011 | Must | Group edit | Complete | Backend lead + Mobile lead | backend-api/src/modules/groups | mobile-app/src/features/groups/GroupsScreen.tsx | Authorized role can edit group metadata; non-authorized users cannot edit; updates are visible in groups list and post targeting chips. |
| P0-012 | Must | Group delete | Complete | Backend lead + Mobile lead | backend-api/src/modules/groups, backend-api/src/modules/posts | mobile-app/src/features/groups/GroupsScreen.tsx | Authorized role can delete group; group posts are handled by policy (remove/archive/migrate); removed group no longer appears in lists or targeting UI. |
| P0-013 | Should | Liker list UI wiring | Not Started | Mobile lead | backend-api/src/modules/likes (already present) | mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/features/feed/screens/PostDetailScreen.tsx | User can open list of users who liked a post; pagination works; profile navigation from liker row works. |
| P0-014 | Should | Messaging attachment parity | Not Started | Backend lead + Mobile lead | backend-api/src/modules/messages, backend-api/src/modules/media, backend-api/src/modules/realtime | mobile-app/src/features/messages/screens/ConversationDetailScreen.tsx | Users can send and receive supported attachment types per policy; upload and render states are robust under reconnect/retry. |
| P0-015 | Should | Message reactions | Not Started | Backend lead + Mobile lead | backend-api/src/modules/messages, backend-api/src/modules/realtime, backend-api/prisma/schema.prisma | mobile-app/src/features/messages/screens/ConversationDetailScreen.tsx | Users can add/remove reactions on message bubbles; reactions sync in realtime for all participants; unread logic remains correct. |


## Phase-by-Phase Implementation Plan (Open Items)

Status normalization rule:
- Use `Complete` (not `Completed`) for finished backlog rows.

Open items as of 2026-03-17:
- P0-013 Liker list UI wiring
- P0-014 Messaging attachment parity
- P0-015 Message reactions

### Phase 1: Spec Finalization and Technical Design (1-2 days) - Complete

Phase 1 completion date:
- 2026-03-17

Approvals:
- Product owner: [x] approved
- Backend lead: [x] approved
- Mobile lead: [x] approved
- QA lead: [x] approved

Finalized policy decisions:

1) Attachments policy (P0-014)
- Supported types:
- Images: image/jpeg, image/png, image/webp
- Video: video/mp4
- Documents: application/pdf
- Unsupported files are rejected with a clear validation message.
- Max size per file:
- Image: 10 MB
- Video: 25 MB
- PDF: 15 MB
- Max attachments per message: 5
- Max total payload per message: 50 MB
- Retry behavior:
- Client auto-retry on transient network/server errors up to 3 attempts using exponential backoff (1s, 2s, 4s).
- User-visible manual retry action remains available after auto-retries are exhausted.
- Non-retryable validation errors do not auto-retry.

2) Reactions policy (P0-015)
- Allowed reaction set: :thumbsup:, :heart:, :laughing:, :astonished:, :cry:, :angry:
- Remove policy:
- A participant may remove only their own reaction.
- Re-pressing the same reaction toggles it off.
- Changing reaction replaces the participant's previous reaction on the same message.
- Realtime behavior:
- Reaction add/remove/update emits conversation-scoped realtime events to all active participants.
- Duplicate reaction events are ignored by idempotency key on client and server.
- Unread counters are not incremented by reaction-only events.

3) UX flow freeze (P0-013, P0-014, P0-015)
- Liker list:
- Entry from feed card likes count and post detail likes count.
- Opens as bottom sheet on mobile with paginated list, avatar/name/subtitle row pattern.
- Tapping a row navigates to profile view.
- Attachment states in conversation detail:
- Pending selection -> Uploading -> Sent.
- Pending/Uploading -> Failed with inline error and Retry action.
- Retry preserves message draft context and position.
- Reactions interaction:
- Long-press on message bubble opens reaction bar.
- Single tap on existing own reaction toggles removal.
- Reaction chips render under bubble with participant counts.

Backend API contract deltas frozen for implementation:
- Messages module:
- Add attachment payload contract on message send endpoint with attachment metadata array:
- attachmentId, mediaType, mimeType, fileName, fileSizeBytes, width, height, durationMs, storageKey, thumbnailKey.
- Add message reactions endpoints:
- PUT /messages/:messageId/reactions
- DELETE /messages/:messageId/reactions/:reactionType
- Response contract includes normalized reaction summary per message.
- Media module:
- Add signed upload initiation contract and upload completion confirmation contract for message attachments.
- Add strict server-side MIME and size validation with typed error responses.
- Realtime module:
- Add events:
- message.attachment.uploaded
- message.attachment.failed
- message.reaction.updated
- Event payload includes conversationId, messageId, actorId, serverTimestamp, eventId.
- Prisma changes:
- Add MessageAttachment entity (or equivalent) linked to Message.
- Add MessageReaction entity with unique composite key (messageId, userId).

Mobile implementation behavior freeze:
- Feed and post detail:
- Likes count press target enabled only when likesCount > 0.
- Empty state copy for liker list: No likes yet.
- Conversation detail:
- Attachment bubble renders by media type with safe fallback tile for unsupported render cases.
- Failed attachment and failed reaction optimistic updates show inline retry without leaving screen.
- Reconnect logic reconciles local optimistic state with latest server message snapshot.

QA phase-1 approved checklist:

| Item | Coverage | Owner | Status |
|---|---|---|---|
| P0-013 liker list open and paginate | Feed entry, detail entry, page 1..N continuity, profile navigation | QA lead | Approved |
| P0-014 attachment validation | File type allow/deny, file size boundaries, count and payload limits | QA lead | Approved |
| P0-014 retry and reconnect | Auto-retry, manual retry, offline/online transition, duplicate event suppression | QA lead | Approved |
| P0-015 reactions behavior | Add, remove, replace, per-user uniqueness, reaction count consistency | QA lead | Approved |
| P0-015 unread regression | No unread increment on reactions, incoming message unread still increments | QA lead | Approved |

Phase 1 exit criteria result:
- API contract changes documented and approved: Complete
- Mobile UI behavior notes approved: Complete
- QA checklist approved for all three items: Complete

### Phase 2: Quick Win Delivery - P0-013 Liker List UI Wiring (2-3 days)

Objectives:
- Ship mobile-only wiring using existing likes backend module.

Implementation scope:
- Mobile: add liker list entry point from feed and post detail.
- Mobile: implement paginated liker list screen/bottom sheet and profile row navigation.
- Backend: validate existing likes pagination response is sufficient; add only minimal non-breaking adjustments if needed.

Validation:
- Manual: open liker list from both entry points, scroll pagination, navigate to profile.
- Automated: add/update UI tests for entry-point tap and pagination fetch behavior.

Exit criteria:
- P0-013 status moves to `Complete`.

### Phase 3: Messaging Platform Parity - P0-014 Attachments (4-6 days)

Objectives:
- Deliver robust attachment send/receive behavior with reconnect/retry resilience.

Implementation scope:
- Backend (`messages`, `media`, `realtime`):
- Add/confirm attachment metadata schema and validation pipeline.
- Ensure upload lifecycle events are emitted for realtime sync.
- Enforce security checks (type/size policy, authorization, signed URL/access policy).
- Mobile (`ConversationDetailScreen.tsx`):
- Add attachment picker and upload queue states (pending, uploading, failed, retry).
- Render received attachments with type-aware UI and safe fallbacks.
- Preserve message order and delivery status during reconnect.

Validation:
- API tests for accepted/rejected attachments and authorization boundaries.
- Realtime tests for reconnect and duplicate event handling.
- Mobile e2e for send, fail, retry, and receive paths.

Exit criteria:
- P0-014 status moves to `Complete`.

### Phase 4: Realtime Collaboration - P0-015 Message Reactions (3-4 days)

Objectives:
- Deliver add/remove reactions with correct realtime sync and unread behavior.

Implementation scope:
- Backend (`messages`, `realtime`, `prisma`):
- Add reaction persistence model and APIs for toggle/add/remove.
- Emit reaction events to conversation participants.
- Keep unread counting semantics unchanged (incoming messages only).
- Mobile (`ConversationDetailScreen.tsx`):
- Add reaction picker and bubble reaction rendering.
- Handle optimistic updates with rollback on server rejection.
- Merge reaction events safely during pagination and reconnect.

Validation:
- Unit/API tests for toggle idempotency and authorization.
- Multi-client realtime test: reaction appears/removes for all participants.
- Regression tests for unread counters and read receipts.

Exit criteria:
- P0-015 status moves to `Complete`.

### Phase 5: Hardening, Regression, and Sign-Off (2-3 days)

Objectives:
- Close cross-feature regressions and finalize governance approvals.

Workstreams:
- Full regression across feed, notifications, and messaging.
- Performance and reliability checks under retry/reconnect/load scenarios.
- Security verification for attachment abuse paths and permission boundaries.

Exit criteria:
- Backlog rows P0-013 to P0-015 set to `Complete`.
- Sign-Off Block checkboxes approved by Product owner, Backend lead, Mobile lead, and QA lead.