# Phase 1 Feature Contract and Scope Lock

Status: ready for signoff
Date: 2026-03-16
Owner: platform architecture group
Source requirements: `../features.md`

## Purpose

This is the Phase 1 scope-lock contract for currently incomplete features. It is the single source of truth for priorities, non-goals, and implementation contracts before coding phases proceed.

## Definitions

- Complete: backend API, mobile UI, realtime/notifications where applicable, and tests exist.
- Partial: at least one of API, UI, or test coverage is missing.
- Deferred: intentionally excluded from near-term execution and documented in non-goals.

## Priority Order

1. P0: Hashtags, Mentions, Poll posts, Event posts, Announcement posts, Pinned posts.
2. P1: Share, Save/bookmark, Search expansion, Liker list UI.
3. P2: Feed media parity, Messaging rich media and reactions.
4. P3: Stories and Reels.

## Feature Contract Details

| Capability | Phase Target | API Contract (Draft) | Data Model Contract (Draft) | UX Behavior Contract (Draft) | Deferred from Initial Delivery |
|---|---|---|---|---|---|
| Stories | 7 | `POST /stories`, `GET /stories/feed`, `GET /stories/:storyId/views`, `POST /stories/:storyId/reactions` | `Story(id, authorId, mediaUrl, mediaType, caption, expiresAt)`; `StoryView(storyId,userId,viewedAt)`; `StoryReaction(storyId,userId,type)` | story rail on home; tap-to-play sequence; auto-expire at 24h; view count owner-only | highlights and advanced editor |
| Reels | 7 | `POST /reels`, `GET /reels/feed`, `POST /reels/:reelId/like`, `POST /reels/:reelId/comment`, `POST /reels/:reelId/share` | `Reel(id, authorId, mediaUrl, durationSec, caption, createdAt)` | vertical reel feed; swipe navigation; like/comment/share actions; upload progress states | filters/music sync templates |
| Hashtags | 2-3 | parser during post create; `GET /hashtags/:tag/posts`; extend `GET /search` with hashtags | `Hashtag(id,name)`; `PostHashtag(postId,hashtagId)` | hashtags highlighted in post body; tap hashtag opens hashtag results | trending ranking v2 |
| Mentions | 2-3 | parser during post/comment create; profile resolve endpoint; mention event notifications | `Mention(id,entityType,entityId,mentionedUserId,createdAt)` | `@` suggestion in composer; mention chips in rendered text; tap opens profile | advanced moderation policy rules |
| Poll posts | 2 | `POST /posts` with `type=poll`; `POST /posts/:postId/polls/:optionId/vote`; `GET /posts/:postId/poll-results` | `Poll(id,postId,question,multipleChoice)`; `PollOption(id,pollId,text)`; `PollVote(pollId,optionId,userId)` | poll card in feed/detail; one-tap vote; voted-state lock; live totals refresh | multi-question polls |
| Event posts | 2-3 | `POST /events`; `GET /events/:eventId`; `POST /events/:eventId/rsvp`; include events in search | `Event(id,postId,title,startAt,endAt,location,createdBy)`; `EventRsvp(eventId,userId,status)` | event card with date/time/location; RSVP selector; attendee count | external calendar sync |
| Announcement posts | 2 | `POST /announcements`; `GET /announcements`; pin + comments-enabled flags | `Announcement(id,postId,audienceScope,commentsEnabled,isPinned,createdBy)` | announcement badge in feed; audience-aware visibility; comments disabled if configured | mandatory-read analytics v2 |
| Pinned posts | 2 | `POST /pins/posts/:postId`; `DELETE /pins/posts/:postId`; `GET /pins` | `PinnedPost(id,scopeType,scopeId,postId,pinnedBy,pinnedAt,sortOrder)` | pinned section appears at top of scope feed; deterministic ordering | pin history audit UI |
| Share post | 2-4 | `POST /posts/:postId/share`; `GET /posts/:postId/shares` | `PostShare(id,postId,userId,targetType,targetId,createdAt)` | share action in post menu; attribution shown on shared item | external network share |
| Save/bookmark | 2-4 | `POST /bookmarks/posts/:postId`; `DELETE /bookmarks/posts/:postId`; `GET /bookmarks/posts` | `Bookmark(userId,postId,createdAt)` | bookmark toggle on post; saved posts screen with pagination | folders/collections |
| Search expansion | 3 | extend `GET /search?q=` to return `hashtags[]` and `events[]` | reuse `Hashtag`, `Event` models and search index views | search tabs/sections for hashtags/events with deep links | semantic ranking |
| Feed media parity | 4 | extend upload and post create for video and file metadata | `PostMedia` extended with `kind`, `durationSec`, `fileSizeBytes` | composer supports image/video/file attach; post cards show proper preview/player | advanced transcoding pipeline |
| Liker list UI | 5 | use existing `GET /likes/posts/:postId/users` | no new model; reuse `Like` | tap like count opens likers list with pagination and profile navigation | hover cards |
| Chat media/file/voice | 6 | extend messaging with `messageType` values `image`,`file`,`voice`; upload contract reuse | `Message` add attachment metadata fields; optional `voiceDurationMs` | conversation detail supports media bubble, file tile, voice player | message edit history |
| Chat reactions | 6 | `POST /messages/:messageId/reactions`; `DELETE /messages/:messageId/reactions/:emoji` | `MessageReaction(messageId,userId,emoji,createdAt)` | long-press message to react; reaction chips update in realtime | custom emoji sets |

## Non-goals for This Execution Window

- Stories highlights and advanced story editor.
- Reel editing studio (music sync, advanced filters, templates).
- Cross-tenant discovery outside active organization boundaries.
- External social network sharing.

## Cross-cutting Requirements

- Authorization remains organization-scoped.
- Notification fan-out must respect notification preferences and mute rules.
- All list endpoints use keyset pagination.
- New contracts require API tests and mobile integration tests.
- Backward compatibility: existing feed, posts, and messaging endpoints must not break current clients.

## Acceptance Criteria for Phase 1

1. Every missing feature has API contract, data model contract, and UX behavior contract defined in this document.
2. Product and engineering recognize this document as the single source of truth for priorities and non-goals.

## Approval and Signature

Single source of truth location: `documentation/phase-1-feature-contract.md`

| Role | Name | Decision | Date | Signature |
|---|---|---|---|---|
| Product Owner | TBD | Pending | TBD | TBD |
| Engineering Lead | TBD | Pending | TBD | TBD |
| Mobile Lead | TBD | Pending | TBD | TBD |
| Backend Lead | TBD | Pending | TBD | TBD |

Note: Document is implementation-ready. Human approvals above are required to mark Phase 1 fully signed.
