import type { FeedPost } from '../shared/api/feed.api';

export type MainTabsParamList = {
  Home: undefined;
  Groups: undefined;
  Chats: undefined;
  Notifications: undefined;
  Menu: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  Search: { query?: string } | undefined;
  PostDetail: { post: FeedPost };
  Profile: { userId?: string } | undefined;
  Conversation: { conversationId: string };
  GroupHub: { groupId: string };
  GroupMembers: { groupId: string };
  GroupSettings: { groupId: string };
  LiveRoom: { groupId: string; sessionId: string; serverUrl: string; token: string; host: boolean };
  Settings: undefined;
  Admin: undefined;
  CommentReports: undefined;
  Preview: { title: string; body: string; icon?: string };
};
