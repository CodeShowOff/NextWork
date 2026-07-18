import type {
  AuthTokensDto,
  FeedPostDto,
  MutedNotificationUsersDto,
  NotificationPreferencesDto,
  PaginatedFeedDto,
  PaginatedNotificationsDto,
} from '@nextwork/api-contracts';

import {
  login,
  requestPasswordReset,
  resendVerification,
  signUp,
  verifyEmail,
} from './auth.api';
import {
  createPost,
  deletePost,
  getPostShareLink,
  listFeed,
  updatePost,
  votePostPoll,
} from './feed.api';
import {
  getNotificationPreferences,
  listNotifications,
  listMutedNotificationUsers,
  markAllNotificationsRead,
  markNotificationRead,
  muteNotificationUser,
  openNotification,
  unmuteNotificationUser,
  updateNotificationPreferences,
} from './notifications.api';

type Assert<T extends true> = T;
type IsAssignable<Expected, Actual> = Actual extends Expected ? true : false;

describe('contracts compatibility', () => {
  it('keeps auth wrappers compatible with generated SDK contracts', async () => {
    const _login: Assert<IsAssignable<Promise<AuthTokensDto>, ReturnType<typeof login>>> = true;
    const _signUp: Assert<IsAssignable<Promise<unknown>, ReturnType<typeof signUp>>> = true;
    const _verifyEmail: Assert<IsAssignable<Promise<{ status: 'ok' }>, ReturnType<typeof verifyEmail>>> = true;
    const _resendVerification: Assert<IsAssignable<Promise<{ status: 'ok'; expiresAt: string | null; debugCode?: string }>, ReturnType<typeof resendVerification>>> = true;
    const _requestPasswordReset: Assert<IsAssignable<Promise<{ status: 'ok'; expiresAt: string | null; debugCode?: string }>, ReturnType<typeof requestPasswordReset>>> = true;

    expect(_login && _signUp && _verifyEmail && _resendVerification && _requestPasswordReset).toBe(true);
  });

  it('keeps feed and poll vote wrappers compatible with generated SDK contracts', async () => {
    const _listFeed: Assert<IsAssignable<Promise<PaginatedFeedDto>, ReturnType<typeof listFeed>>> = true;
    const _createPost: Assert<IsAssignable<Promise<FeedPostDto>, ReturnType<typeof createPost>>> = true;
    const _updatePost: Assert<IsAssignable<Promise<FeedPostDto>, ReturnType<typeof updatePost>>> = true;
    const _deletePost: Assert<IsAssignable<Promise<{ status: 'ok' }>, ReturnType<typeof deletePost>>> = true;
    const _votePostPoll: Assert<IsAssignable<Promise<FeedPostDto>, ReturnType<typeof votePostPoll>>> = true;
    const _getPostShareLink: Assert<IsAssignable<Promise<{ postId: string; shareUrl: string; appUrl: string }>, ReturnType<typeof getPostShareLink>>> = true;

    expect(_listFeed && _createPost && _updatePost && _deletePost && _votePostPoll && _getPostShareLink).toBe(true);
  });

  it('keeps notifications wrappers compatible with generated SDK contracts', async () => {
    const _list: Assert<IsAssignable<Promise<PaginatedNotificationsDto>, ReturnType<typeof listNotifications>>> = true;
    const _markRead: Assert<IsAssignable<Promise<{ status: 'ok' }>, ReturnType<typeof markNotificationRead>>> = true;
    const _open: Assert<IsAssignable<Promise<{ status: 'ok'; readApplied: boolean; action: { target: 'messages' | 'profile' | 'feed'; entityType: string; entityId: string } }>, ReturnType<typeof openNotification>>> = true;
    const _markAll: Assert<IsAssignable<Promise<{ status: 'ok'; updated: number }>, ReturnType<typeof markAllNotificationsRead>>> = true;
    const _getPrefs: Assert<IsAssignable<Promise<NotificationPreferencesDto>, ReturnType<typeof getNotificationPreferences>>> = true;
    const _updatePrefs: Assert<IsAssignable<Promise<NotificationPreferencesDto>, ReturnType<typeof updateNotificationPreferences>>> = true;
    const _listMuted: Assert<IsAssignable<Promise<MutedNotificationUsersDto>, ReturnType<typeof listMutedNotificationUsers>>> = true;
    const _mute: Assert<IsAssignable<Promise<{ status: 'ok' }>, ReturnType<typeof muteNotificationUser>>> = true;
    const _unmute: Assert<IsAssignable<Promise<{ status: 'ok' }>, ReturnType<typeof unmuteNotificationUser>>> = true;

    expect(_list && _markRead && _open && _markAll && _getPrefs && _updatePrefs && _listMuted && _mute && _unmute).toBe(true);
  });
});
