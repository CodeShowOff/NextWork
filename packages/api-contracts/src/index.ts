export interface UserProfileDto {
  id: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
}

export interface FeedPostDto {
  id: string;
  authorId: string;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}
