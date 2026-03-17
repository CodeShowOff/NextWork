# Phase 0: Gap Lock and Spec Freeze

Date: 2026-03-17
Scope: lock all currently missing functionality into one approved backlog so no item is lost during implementation.

## Sign-Off Block

- Product owner: [ ] approved
- Backend lead: [ ] approved
- Mobile lead: [ ] approved
- QA lead: [ ] approved

Definition of done for Phase 0:
- Every missing feature has an owner.
- Every missing feature is mapped to backend modules and mobile src surfaces.
- Every missing feature has acceptance criteria that can be tested.
- Priority order is frozen for execution planning.

## Locked Backlog

Status legend: Complete, In Progress, Not Started

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

## Current Code Surface Map (Baseline)

Backend module roots used for Phase 0 mapping:
- backend-api/src/modules/auth
- backend-api/src/modules/organizations
- backend-api/src/modules/groups
- backend-api/src/modules/posts
- backend-api/src/modules/feed
- backend-api/src/modules/likes
- backend-api/src/modules/messages
- backend-api/src/modules/notifications
- backend-api/src/modules/search
- backend-api/src/modules/media

Mobile feature roots used for Phase 0 mapping:
- mobile-app/src/features/auth
- mobile-app/src/features/feed
- mobile-app/src/features/groups
- mobile-app/src/features/profile
- mobile-app/src/features/messages
- mobile-app/src/features/notifications
- mobile-app/src/features/search

## Freeze Notes

- This backlog is the source of truth for feature completeness work.
- New gaps discovered after this date must be added as new IDs and re-signed.
- Implementation cannot begin for a row until owner and acceptance criteria are confirmed by product and QA.

## Phase-by-Phase Implementation Plan (Open Items)

Status normalization rule:
- Use `Complete` (not `Completed`) for finished backlog rows.

Open items as of 2026-03-17:
- P0-013 Liker list UI wiring
- P0-014 Messaging attachment parity
- P0-015 Message reactions

### Phase 1: Spec Finalization and Technical Design (1-2 days)

Objectives:
- Confirm product and QA policy details for attachments (supported types, max sizes, retry behavior) and reactions (allowed emoji set, remove policy, realtime behavior).
- Freeze UX flows for liker list, attachment states (uploading, failed, retry), and reaction picker interactions.

Workstreams:
- Backend lead: finalize API contract deltas for message attachments and reactions.
- Mobile lead: finalize UI states and navigation for liker list and conversation detail enhancements.
- QA lead: derive test matrix from acceptance criteria and edge cases.

Exit criteria:
- API contract changes documented and approved.
- Mobile UI behavior notes approved.
- QA checklist approved for all three items.

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