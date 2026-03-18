**Role-Based User Flow (Employee vs Manager vs Admin)**

Below is the practical flow for each role in this app, based on current implementation.

## **Shared Entry Flow (All Roles)**
1. Open app.
2. Login or Sign Up.
3. If no organization exists for user: create one, or join one via invite token/link.
4. App loads main tabs: Feed, Groups, Search, Messages, Notifications, Profile.
5. User can switch active organization (if member of multiple orgs).

---

## **Employee Flow**
1. **Join workspace**
2. Accept invite token/link from manager/admin.
3. Automatically (or manually) switch into that organization context.

4. **Discover teams**
5. Go to Groups tab.
6. Join relevant groups (Engineering, Marketing, etc.).
7. View group members to find teammates.

8. **Daily social activity**
9. Open Feed and post updates (text + image optional).
10. Choose posting scope: global or specific group.
11. Like and comment on posts.
12. Open post detail for threaded discussion/replies.

13. **People collaboration**
14. Search users, groups, posts.
15. Open teammate profiles.
16. Follow/unfollow coworkers.
17. Start direct conversation by user ID in Messages.

18. **Communication loop**
19. Receive unread badges for Messages/Notifications.
20. Open Notifications, mark read, navigate to related post/profile/chat.
21. Use DMs with real-time typing and read status.

22. **Personal account**
23. Update own profile info.
24. Review own posts/followers/following.
25. Sign out when done.

---

## **Manager Flow**
Managers do everything an Employee does, plus team coordination actions.

1. **Team setup**
2. Create groups for departments/projects.
3. Generate invite tokens for teammates.
4. Share invite token externally for onboarding.

5. **Organization operation**
6. Switch between organizations (if managing multiple).
7. Track group size/member list by opening each group’s members panel.
8. Guide new users to join correct groups.

9. **Content leadership**
10. Post team updates in group-scoped feed.
11. Engage in comments to drive discussion.
12. Use search to monitor project-related posts/users/groups.

13. **Communication management**
14. Start/direct chats with specific users.
15. Use notifications preferences and mute controls to reduce noise.

---

## **Admin Flow**
In current app state, there is **no dedicated admin dashboard UI yet** (user management/moderation/analytics panels are not shipped).  
So “Admin” practically behaves like a power manager with org bootstrapping and invite control.

1. **Tenant/bootstrap actions**
2. Create initial organization (onboard flow).
3. Become active in org context.
4. Create core groups and seed structure.

5. **Access provisioning**
6. Generate invite tokens repeatedly for new employees.
7. Validate users can join and switch into correct organization.

8. **Cross-team visibility**
9. Switch org context if admin belongs to multiple orgs.
10. Use search/feed/groups/profile surfaces for operational oversight.

9. **Current limitation**
10. No dedicated admin-only screens yet for:
11. Role assignment UI (Admin/Manager/Employee),
12. moderation console,
13. org analytics dashboard,
14. branding controls panel.

---

## **Quick Comparison**
1. **Employee:** consume + contribute content, messaging, profile, follow.
2. **Manager:** employee capabilities + group creation + invite distribution + team coordination.
3. **Admin (current):** manager-like operations + org bootstrap, but no full admin panel yet.