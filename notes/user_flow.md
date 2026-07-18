Here is the NextWork app user flow, based on what is implemented right now in this repo.

1. App launch and session gate  
- On app start, it checks whether an access token exists in the local session store.  
- If token exists, user goes straight into the main tab app.  
- If token is missing, user sees Login/Sign Up first.  
- Source: mobile-app/src/app/App.tsx, mobile-app/src/shared/session/session.store.ts

2. Authentication flow  
- User can choose Login or Sign Up.  
- Sign Up requires display name, email, password.  
- Login requires email and password.  
- App calls auth API, stores token, then immediately calls current user endpoint to resolve the real user id.  
- User can optionally override API base URL and realtime URL (useful for local/dev environments).  
- Source: mobile-app/src/features/auth/AuthScreen.tsx, mobile-app/src/shared/api/auth.api.ts, backend-api/src/modules/auth/auth.controller.ts, backend-api/src/modules/users/users.controller.ts

3. Invite link and organization join flow  
- App listens for deep links containing invite token.  
- If user is already authenticated and invite token exists, app auto-accepts invite and tries to switch active organization.  
- In Groups tab, user can also paste invite token manually and accept it.  
- Result: user becomes member of org and context switches to that org.  
- Source: mobile-app/src/shared/linking/invite-linking.ts, mobile-app/src/app/App.tsx, mobile-app/src/features/groups/GroupsScreen.tsx, backend-api/src/modules/invites/invites.controller.ts, backend-api/src/modules/organizations/organizations.controller.ts

4. Main navigation after login  
- Bottom tabs are: Feed, Groups, Search, Messages, Notifications, Profile.  
- Messages and Notifications tabs show unread badges.  
- Source: mobile-app/src/app/App.tsx

5. Groups and organization management  
- If user has no organization yet, first flow is organization onboarding (create org).  
- If user has multiple organizations, they can switch active org using chips.  
- User can create groups, join groups, view group members, and generate invite tokens.  
- This tab is effectively the nextwork context manager for the rest of the app.  
- Source: mobile-app/src/features/groups/GroupsScreen.tsx, backend-api/src/modules/groups/groups.controller.ts, backend-api/src/modules/organizations/organizations.controller.ts

6. Feed flow (core social usage)  
- User creates post from composer with text and optional image upload.  
- User can target post globally or to a selected group.  
- Feed is paginated and refreshable.  
- For each post, user can open author profile, like/unlike, and open comments.  
- Source: mobile-app/src/features/feed/FeedScreen.tsx, mobile-app/src/shared/api/feed.api.ts, backend-api/src/modules/feed/feed.controller.ts, backend-api/src/modules/posts/posts.controller.ts, backend-api/src/modules/likes/likes.controller.ts

7. Post detail and comments flow  
- Inside post detail, user can like/unlike, read comments, add comment, reply, and delete own comment.  
- Comment and like counts are synced back into feed cache so UI stays consistent.  
- Source: mobile-app/src/features/feed/screens/PostDetailScreen.tsx, backend-api/src/modules/comments/comments.controller.ts

8. Search flow  
- Debounced search across users, groups, posts.  
- Tapping result routes user to profile, group focus, or post detail view.  
- Source: mobile-app/src/features/search/SearchScreen.tsx, backend-api/src/modules/search/search.controller.ts

9. Messaging flow (DMs)  
- User can create direct conversation by entering target user id.  
- Conversation list is paginated and sorted by latest activity.  
- Conversation detail supports real-time incoming messages, typing indicators, read state, optimistic sending, and mark-as-read logic.  
- Realtime socket is authenticated with JWT and connected to the realtime namespace.  
- Source: mobile-app/src/features/messages/screens/ConversationsScreen.tsx, mobile-app/src/features/messages/screens/ConversationDetailScreen.tsx, mobile-app/src/features/messages/hooks/useConversations.ts, mobile-app/src/features/messages/hooks/useMessages.ts, mobile-app/src/shared/realtime/messages.socket.ts, backend-api/src/modules/messages/messages.controller.ts, backend-api/src/modules/realtime/messages.gateway.ts

10. Notifications flow  
- Notifications list is paginated with mark one read / mark all read.  
- User can configure notification preferences (likes, comments, follows, messages).  
- User can mute specific actors from sending notifications.  
- Realtime notification events update list and badge count live.  
- Tapping a notification routes to related entity (conversation, profile, post).  
- Source: mobile-app/src/features/notifications/screens/NotificationsScreen.tsx, mobile-app/src/features/notifications/hooks/useNotifications.ts, mobile-app/src/features/notifications/hooks/useNotificationBadgeBridge.ts, mobile-app/src/features/notifications/navigation/notification-navigation.ts, mobile-app/src/shared/realtime/notifications.socket.ts, backend-api/src/modules/notifications/notifications.controller.ts

11. Profile and follow flow  
- User can view own profile and edit profile metadata.  
- User can view another user profile, follow/unfollow, and open followers/following lists.  
- User can browse that user’s posts.  
- Source: mobile-app/src/features/profile/screens/ProfileViewScreen.tsx, mobile-app/src/features/profile/screens/FollowListScreen.tsx, backend-api/src/modules/profiles/profiles.controller.ts, backend-api/src/modules/follows/follows.controller.ts, backend-api/src/modules/posts/posts.controller.ts

12. Sign out flow  
- Sign out clears in-memory session, returning user to auth screen.  
- Available from Profile and Messages screens.  
- Source: mobile-app/src/features/profile/screens/ProfileViewScreen.tsx, mobile-app/src/features/messages/screens/ConversationsScreen.tsx

What this means in real life (typical employee journey)
- User installs app, signs up/logs in.
- If invited, joins organization from link/token.
- Sets active organization and joins relevant groups.
- Starts posting updates, commenting, liking.
- Searches colleagues/groups/posts as needed.
- Uses DMs for direct communication.
- Receives live notifications and tunes preferences.
- Maintains profile and follows coworkers.

Important current gap versus product vision
- Stories, reels, hashtags, mentions, polls, event posts, announcement posts, pinned posts, share/save flows, richer media parity are still pending/not complete.
- Source: Pendings.md, features.md, backend-api/src/app.module.ts

If you want, I can next give you:
1. A role-based flow (Employee vs Manager vs Admin).  
2. A screen-by-screen flowchart with decision points and API calls.  
3. A “day in the life” scenario showing exactly what happens from morning login to end of day.