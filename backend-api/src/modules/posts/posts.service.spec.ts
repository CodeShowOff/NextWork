import { ForbiddenException } from '@nestjs/common';

import { BackgroundJobsService } from '../../common/reliability/background-jobs.service';
import { MediaService } from '../media/media.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsRepository } from './posts.repository';
import { PostsService } from './posts.service';

describe('PostsService media URL validation', () => {
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
  } as unknown as jest.Mocked<MediaService>;

  const service = new PostsService(
    postsRepositoryMock,
    backgroundJobsServiceMock,
    mediaServiceMock,
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
          url: 'https://cdn.workplace.local/uploads/another-user/abc.jpg',
          type: 'image',
        },
      ],
    };

    await expect(service.createPost('user-1', payload)).rejects.toBeInstanceOf(ForbiddenException);
    expect(postsRepositoryMock.create).not.toHaveBeenCalled();
  });
});
