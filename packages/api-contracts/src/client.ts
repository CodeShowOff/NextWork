interface ApiEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
  path: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapEnvelope<T>(value: unknown): T {
  if (
    isObject(value) &&
    value.success === true &&
    'data' in value &&
    'timestamp' in value &&
    'path' in value
  ) {
    const envelope = value as unknown as ApiEnvelope<T>;
    return envelope.data;
  }

  return value as T;
}

function toQueryString(query?: Record<string, unknown>): string {
  if (!query) {
    return '';
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    search.set(key, String(value));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export interface WorkplaceApiClientOptions {
  baseUrl: string | (() => string);
  getAccessToken?: () => string | undefined;
  onUnauthorized?: (context: { path: string; status: number }) => Promise<string | undefined> | string | undefined;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface SignUpRequestDto {
  email: string;
  password: string;
  displayName: string;
  fullName: string;
  organizationName: string;
  organizationSize: string;
  jobTitle: string;
  inviteToken?: string;
}

export interface SignUpResultDto {
  status: 'verification_required';
  email: string;
  expiresAt: string;
  debugCode?: string;
}

export interface FeedPostMediaDto {
  id: string;
  url: string;
  type: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface FeedPostDto {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  media: FeedPostMediaDto[];
  taggedUserIds: string[];
  hashtags: string[];
  poll: {
    question: string;
    options: Array<{
      id: string;
      text: string;
      voteCount: number;
    }>;
    totalVotes: number;
    votedOptionId: string | null;
  } | null;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  stats: {
    likeCount: number;
    commentCount: number;
  };
}

export interface PaginatedFeedDto {
  items: FeedPostDto[];
  nextCursor: string | null;
}

export type PaginatedPostsDto = PaginatedFeedDto;

export interface CreatePostRequestDto {
  content: string;
  visibility?: 'public' | 'followers' | 'private';
  groupId?: string;
  taggedUserIds?: string[];
  poll?: {
    question: string;
    options: Array<{
      text: string;
    }>;
  };
  media?: {
    url: string;
    type: string;
    width?: number;
    height?: number;
  }[];
}

export interface UpdatePostRequestDto {
  content?: string;
  visibility?: 'public' | 'followers' | 'private';
}

export interface VotePollRequestDto {
  optionId: string;
}

export interface PostShareLinkDto {
  postId: string;
  shareUrl: string;
  appUrl: string;
}

export interface NotificationItemDto {
  id: string;
  userId: string;
  actorId: string | null;
  type: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface PaginatedNotificationsDto {
  items: NotificationItemDto[];
  nextCursor: string | null;
}

export interface NotificationPreferencesDto {
  likeEnabled: boolean;
  commentEnabled: boolean;
  followEnabled: boolean;
  messageEnabled: boolean;
}

export interface MutedNotificationUsersDto {
  items: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
}

export interface UpdateNotificationPreferencesRequestDto {
  likeEnabled?: boolean;
  commentEnabled?: boolean;
  followEnabled?: boolean;
  messageEnabled?: boolean;
}

export interface SendThanksRequestDto {
  targetUserId: string;
  messageTemplate?: string;
  notificationType?: 'thanks' | 'thanks-note';
}

export async function requestJsonWithOptions<TResponse>(
  options: WorkplaceApiClientOptions,
  path: string,
  init?: RequestInit,
  query?: Record<string, unknown>,
): Promise<TResponse> {
  async function executeRequest(overrideToken?: string): Promise<Response> {
    const resolvedBaseUrl =
      typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl;
    const token = overrideToken ?? options.getAccessToken?.();

    return fetch(`${resolvedBaseUrl}${path}${toQueryString(query)}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  }

  let response = await executeRequest();
  if (response.status === 401 && options.onUnauthorized) {
    const refreshedAccessToken = await options.onUnauthorized({ path, status: 401 });
    if (refreshedAccessToken) {
      response = await executeRequest(refreshedAccessToken);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return unwrapEnvelope<TResponse>(await response.json());
}

export function createWorkplaceApiClient(options: WorkplaceApiClientOptions) {
  async function request<TResponse>(
    path: string,
    init?: RequestInit,
    query?: Record<string, unknown>,
  ): Promise<TResponse> {
    return requestJsonWithOptions<TResponse>(options, path, init, query);
  }

  return {
    auth: {
      login(payload: { email: string; password: string }) {
        return request<AuthTokensDto>('/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      signUp(payload: SignUpRequestDto) {
        return request<SignUpResultDto>('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      verifyEmail(payload: { email: string; token: string }) {
        return request<{ status: 'ok' }>('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      resendVerification(payload: { email: string }) {
        return request<{ status: 'ok'; expiresAt: string | null; debugCode?: string }>('/auth/resend-verification', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      requestPasswordReset(payload: { email: string }) {
        return request<{ status: 'ok'; expiresAt: string | null; debugCode?: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      confirmPasswordReset(payload: { email: string; token: string; newPassword: string }) {
        return request<{ status: 'ok' }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },
    feed: {
      list(query: { limit: number; before?: string; groupId?: string }) {
        return request<PaginatedFeedDto>('/feed', { method: 'GET' }, query as Record<string, unknown>);
      },
    },
    posts: {
      create(payload: CreatePostRequestDto) {
        return request<FeedPostDto>('/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      listMine(query: { limit: number; before?: string }) {
        return request<PaginatedPostsDto>('/posts/me', { method: 'GET' }, query as Record<string, unknown>);
      },
      listByUser(userId: string, query: { limit: number; before?: string }) {
        return request<PaginatedPostsDto>(
          `/posts/user/${userId}`,
          { method: 'GET' },
          query as Record<string, unknown>,
        );
      },
      update(postId: string, payload: UpdatePostRequestDto) {
        return request<FeedPostDto>(`/posts/${postId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      },
      delete(postId: string) {
        return request<{ status: 'ok' }>(`/posts/${postId}`, {
          method: 'DELETE',
        });
      },
      getShareLink(postId: string) {
        return request<PostShareLinkDto>(`/posts/${postId}/share-link`, {
          method: 'GET',
        });
      },
      votePoll(postId: string, payload: VotePollRequestDto) {
        return request<FeedPostDto>(`/posts/${postId}/poll/vote`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
    },
    notifications: {
      list(query: { limit: number; before?: string }) {
        return request<PaginatedNotificationsDto>(
          '/notifications',
          { method: 'GET' },
          query as Record<string, unknown>,
        );
      },
      unreadCount() {
        return request<{ unreadCount: number }>('/notifications/unread-count', {
          method: 'GET',
        });
      },
      markRead(notificationId: string) {
        return request<{ status: 'ok' }>(
          `/notifications/${notificationId}/read`,
          { method: 'POST' },
        );
      },
      open(notificationId: string) {
        return request<{
          status: 'ok';
          readApplied: boolean;
          action: {
            target: 'messages' | 'profile' | 'feed';
            entityType: string;
            entityId: string;
          };
        }>(
          `/notifications/${notificationId}/open`,
          { method: 'POST' },
        );
      },
      markAllRead() {
        return request<{ status: 'ok'; updated: number }>('/notifications/read-all', {
          method: 'POST',
        });
      },
      getPreferences() {
        return request<NotificationPreferencesDto>('/notifications/preferences', {
          method: 'GET',
        });
      },
      updatePreferences(payload: UpdateNotificationPreferencesRequestDto) {
        return request<NotificationPreferencesDto>('/notifications/preferences', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      },
      listMutedUsers() {
        return request<MutedNotificationUsersDto>('/notifications/muted-users', {
          method: 'GET',
        });
      },
      muteUser(userId: string) {
        return request<{ status: 'ok' }>(
          `/notifications/muted-users/${userId}`,
          { method: 'POST' },
        );
      },
      unmuteUser(userId: string) {
        return request<{ status: 'ok' }>(
          `/notifications/muted-users/${userId}`,
          { method: 'DELETE' },
        );
      },
      sendThanks(payload: SendThanksRequestDto) {
        return request<{
          status: 'ok';
          delivered: boolean;
          muted: boolean;
          notificationId: string | null;
          conversationId: string | null;
          messageId: string | null;
        }>(
          '/notifications/profile-actions/thanks',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );
      },
    },
  };
}
