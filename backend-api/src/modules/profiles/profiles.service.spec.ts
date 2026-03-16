import { NotFoundException } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  let profilesService: ProfilesService;

  const profilesRepositoryMock = {
    findByUserId: jest.fn(),
    updateByUserId: jest.fn(),
    countPostsByUserId: jest.fn(),
    getFollowCounts: jest.fn(),
    isFollowing: jest.fn(),
  } as unknown as ProfilesRepository;

  const cacheServiceMock = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    deleteByKey: jest.fn(),
  } as unknown as CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    profilesService = new ProfilesService(profilesRepositoryMock, cacheServiceMock);
  });

  it('throws NotFoundException if profile does not exist', async () => {
    (profilesRepositoryMock.findByUserId as jest.Mock).mockResolvedValue(null);
    (cacheServiceMock.getJson as jest.Mock).mockResolvedValue(null);

    await expect(profilesService.findByUserId('missing', 'viewer')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns profile with counters and relationship', async () => {
    (cacheServiceMock.getJson as jest.Mock).mockResolvedValue(null);
    (profilesRepositoryMock.findByUserId as jest.Mock).mockResolvedValue({
      userId: 'u2',
      displayName: 'User Two',
      bio: 'Hi',
      avatarUrl: null,
      jobTitle: null,
      organizationSize: null,
      createdAt: new Date('2026-03-16T00:00:00.000Z'),
      updatedAt: new Date('2026-03-16T00:00:00.000Z'),
    });
    (profilesRepositoryMock.countPostsByUserId as jest.Mock).mockResolvedValue(7);
    (profilesRepositoryMock.getFollowCounts as jest.Mock).mockResolvedValue([11, 5]);
    (profilesRepositoryMock.isFollowing as jest.Mock).mockResolvedValue(true);

    const result = await profilesService.findByUserId('u2', 'u1');

    expect(result.counters.posts).toBe(7);
    expect(result.counters.followers).toBe(11);
    expect(result.counters.following).toBe(5);
    expect(result.relationship.isFollowing).toBe(true);
  });

  it('updates existing profile', async () => {
    (profilesRepositoryMock.findByUserId as jest.Mock).mockResolvedValue({
      userId: 'u1',
      displayName: 'User',
    });
    (cacheServiceMock.getJson as jest.Mock).mockResolvedValue(null);
    (profilesRepositoryMock.updateByUserId as jest.Mock).mockResolvedValue({
      userId: 'u1',
      displayName: 'New Name',
      bio: 'Updated',
      avatarUrl: 'https://example.com/avatar.png',
    });

    const result = await profilesService.updateMyProfile('u1', {
      displayName: 'New Name',
      bio: 'Updated',
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(result.displayName).toBe('New Name');
    expect(profilesRepositoryMock.updateByUserId).toHaveBeenCalledWith('u1', {
      displayName: 'New Name',
      bio: 'Updated',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });
});
