**Proposed Implementation Plan (Phase-by-Phase)**

1. **Phase 0: Scope Lock + Architecture Contracts (3-5 days)**
- Goal: Freeze product scope and API contracts for all missing areas so backend/mobile can build in parallel.
- Backend work:
- Add ADRs and API contracts for Stories, Reels, Events, Calendar, Admin, Bookmarks, Voice Messages.
- Update module roadmap in app.module.ts comments into concrete implementation tickets.
- Mobile work:
- Define navigation + screen map for new surfaces (Stories/Reels tabs, Events, Admin, Saved posts).
- Acceptance criteria:
- Signed API contracts in packages/api-contracts.
- End-to-end user journeys documented for each gap.
- Test plan approved (unit + integration + e2e).

2. **Phase 1: Push Notifications End-to-End Wiring (1 week)**
- Goal: Activate device token registration flow already supported by backend.
- Backend work:
- Validate and harden current token lifecycle endpoints in notifications.controller.ts.
- Add observability for token health, stale token cleanup, delivery success/failure.
- Mobile work:
- Add app startup/login hooks to register token + heartbeat + unregister on logout using notifications.api.ts.
- Add permission prompts + retry/backoff + token refresh handling.
- Acceptance criteria:
- New login registers token automatically.
- Logout unregisters token.
- Token refresh updates backend without manual action.
- Delivery telemetry visible in dashboards.

3. **Phase 2: Save/Bookmark Posts (1 week)**
- Goal: Close “save post” gap with full backend + UI.
- Backend work:
- Create Bookmarks module (model + controller + service): save/unsave/list-saved.
- Include feed post metadata for “savedByMe” or dedicated saved feed endpoint.
- Mobile work:
- Add Save/Unsave action in FeedScreen.tsx and PostDetailScreen.tsx.
- Add Saved Posts screen under Profile/Feed navigation.
- Acceptance criteria:
- Users can save/unsave from both feed and detail.
- Saved posts list paginates and syncs state immediately.
- Idempotent behavior on repeated taps.

4. **Phase 3: Voice Messaging Pipeline (1.5-2 weeks)**
- Goal: Add dedicated audio message support (record, upload, playback).
- Backend work:
- Extend message attachment validation in messages.service.ts and DTO/controller in messages.controller.ts for audio MIME types.
- Add duration/codec validation and max size policy.
- Mobile work:
- Extend composer in MessageComposer.tsx for hold-to-record/send voice note.
- Update send pipeline in useSendMessage.ts and transport types in messages.api.ts.
- Add waveform or duration-based bubble in conversation detail.
- Acceptance criteria:
- Record/send/play voice notes end-to-end.
- Works with realtime updates and retry on network failure.
- Proper permission handling and clear UX on denied mic access.

5. **Phase 4: Events + Calendar Foundation (2 weeks)**
- Goal: Deliver event creation, RSVP, reminders, calendar view.
- Backend work:
- Add Events module (CRUD, RSVP states, reminders schedule, org/group visibility).
- Add calendar query endpoints (range-based).
- Mobile work:
- Add Events list + Event detail + RSVP flow.
- Add calendar screen and event reminders.
- Acceptance criteria:
- Users can create and RSVP events.
- Calendar displays events by date range.
- Reminder notifications are triggered and visible in notifications center.

6. **Phase 5: Admin Dashboard Core (2 weeks)**
- Goal: Deliver minimum viable admin controls and analytics.
- Backend work:
- Add Admin module with role guardrails.
- User management endpoints, content moderation actions, and analytics summaries.
- Mobile/web work:
- If mobile-only: create admin-only screens for user/content controls.
- If web-admin planned: ship dedicated admin app page set and role-gated access.
- Acceptance criteria:
- Admin can manage users and moderate content safely.
- Audit logs recorded for admin actions.
- Basic engagement metrics available.

7. **Phase 6: Stories (MVP) (2 weeks)**
- Goal: Ship 24-hour story lifecycle.
- Backend work:
- Stories module, expiry policies, views/reactions model.
- Media constraints + visibility rules.
- Mobile work:
- Story tray on home, story viewer, create story UI (image/video/text).
- Story reactions and view counters.
- Acceptance criteria:
- Story publish/view/reaction works.
- Stories auto-expire at 24h.
- Performance acceptable on low-end devices.

8. **Phase 7: Reels (MVP) (2-3 weeks)**
- Goal: Ship short-video reels with basic engagement.
- Backend work:
- Reels module, video metadata, likes/comments/share linkage.
- Feed ranking rules (initially chronological + basic relevance).
- Mobile work:
- Vertical reel player, create/upload reel, engagement controls.
- Acceptance criteria:
- Reels create/playback smooth on target devices.
- Engagement events (like/comment/share) fully tracked.
- Crash-free and memory-safe scrolling.

9. **Phase 8: Production Hardening + Rollout (1-2 weeks)**
- Goal: Reduce risk before broad release.
- Work:
- Load/perf tests for feed, messaging, reels, stories.
- Security checks (authz, abuse limits, moderation flows).
- Feature flags + staged rollout by organization.
- Acceptance criteria:
- SLOs met, key journeys green in e2e suite, rollback plan validated.

---