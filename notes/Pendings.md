Remaining Gaps (True Current Gaps):

Stories and reels are still not implemented.

Messaging uses manual token bootstrap fallback when session is missing; auto-bootstrap UX can still be improved.

Media flow currently covers image upload; richer media parity (video/files/voice) is not complete.

Extended social objects from features.md:
- Partial: hashtags, mentions/tagged users.
- Pending: events, announcements, pinned posts, save/bookmark.


---

Short answer: no, the pending/incomplete items are not all implemented yet.

Current audit result for the non-COMPLETE rows:

| Feature | Current reality |
|---|---|
| Stories | Not implemented |
| Reels | Not implemented |
| Hashtags | Partial (extraction/display exists; no hashtag discovery flow yet) |
| Mentions | Partial (tagged users flow exists; full @mention UX/parsing is incomplete) |
| Poll posts | Implemented (create, vote, and render poll state) |
| Event posts | Not implemented |
| Announcement posts | Not implemented |
| Pinned posts | Not implemented |
| Save/bookmark | Not implemented |
| Feed media parity | Partial (image/video only, no file parity fields/flows) |
| Messaging rich media | Partial (attachment model/UI flow exists; voice-notes parity still pending) |
| Search expansion | Partial (users/groups/posts only, no hashtags/events result sections) |

Evidence highlights:
- Planned modules still only listed as roadmap comments in app.module.ts.
- No backend module files found for stories/reels/hashtags/mentions/polls/events/announcements/bookmarks/shares under modules.
- Feed media currently constrained to image/video in backend DTO at post-media-input.dto.ts, and upload API is image-only in mobile at media.api.ts.
- Messaging send payload now supports attachments, but voice-message parity remains incomplete.
- Search response only includes users/groups/posts in backend search.service.ts and mobile search.api.ts, and UI copy also reflects that in SearchScreen.tsx.

So to your question: pending/incomplete features are not already fully implemented now.

Natural next steps:
1. I can update the tracker statuses in your contract doc to reflect this exact audit.
2. I can generate a gap checklist per feature (API, UI, tests) so your team can execute phase by phase.
3. I can start implementing one high-priority pending feature (for example hashtags + search expansion) end to end.