import { ForbiddenException } from '@nestjs/common';

import { BackgroundJobsService } from '../../common/reliability/background-jobs.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

describe('PostsService media validation', () => {
  const postsRepositoryMock: jest.Mocked<PostsRepository> = {
    findGroupById: jest.fn(),
    isGroupMember: jest.fn(),
    create: jest.fn(),
    listFollowerIds: jest.fn(),
    listGroupMemberIds: jest.fn(),
    findByUserId: jest.fn(),
    findFeedPosts: jest.fn(),
  } as unknown as jest.Mocked<PostsRepository>;

  const backgroundJobsServiceMock: jest.Mocked<BackgroundJobsService> = {
    enqueueCachePrefixInvalidation: jest.fn(),
    consumeCacheInvalidationJobs: jest.fn(),
  } as unknown as jest.Mocked<BackgroundJobsService>;

  const mediaServiceMock: jest.Mocked<MediaService> = {
    createUploadContract: jest.fn(),
    isPublicMediaUrlAllowed: jest.fn(),
    assertMediaObjectAvailableForPost: jest.fn(),
  } as unknown as jest.Mocked<MediaService>;

  const notificationsServiceMock: jest.Mocked<NotificationsService> = {
    createNotification: jest.fn(),
    listForUser: jest.fn(),
    getUnreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    getNotificationCreatedChannel: jest.fn(),
    getNotificationReadChannel: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    listMutedActors: jest.fn(),
    muteActor: jest.fn(),
    unmuteActor: jest.fn(),
    sendThanks: jest.fn(),
  } as unknown as jest.Mocked<NotificationsService>;

  const service = new PostsService(
    postsRepositoryMock,
    backgroundJobsServiceMock,
    mediaServiceMock,
    notificationsServiceMock,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects post creation when media URL is not allowed for user', async () => {
    mediaServiceMock.isPublicMediaUrlAllowed.mockReturnValue(false);

    const payload: CreatePostDto = {
      content: 'hello',
      visibility: 'public',
      media: [
        {
          url: 'https://cdn.nextwork.local/uploads/another-user/abc.jpg',
          type: 'image',
        },
      ],
    };

    await expect(service.createPost('user-1', payload)).rejects.toBeInstanceOf(ForbiddenException);
    expect(postsRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('requires a scanned MediaObject before publishing a new post attachment', async () => {
    mediaServiceMock.assertMediaObjectAvailableForPost.mockRejectedValue(
      new ForbiddenException('This file cannot be published until its security scan succeeds.'),
    );

    await expect(
      service.createPost('user-1', {
        content: 'hello',
        media: [{ mediaId: '0aa66275-838c-48ea-b63a-2ee1d4d12070', type: 'image' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mediaServiceMock.assertMediaObjectAvailableForPost).toHaveBeenCalledWith(
      'user-1',
      undefined,
      '0aa66275-838c-48ea-b63a-2ee1d4d12070',
    );
  });
});
