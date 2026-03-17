import { Injectable, NotFoundException } from '@nestjs/common';
import { Profile } from '@prisma/client';

import { CacheService } from '../../common/cache/cache.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesRepository } from './profiles.repository';

export interface ProfileView {
  userId: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  organizationSize: string | null;
  createdAt: string;
  updatedAt: string;
  counters: {
    posts: number;
    followers: number;
    following: number;
    groupsFollowed: number;
    skillsEntries: number;
  };
  relationship: {
    isFollowing: boolean;
  };
}

interface ProfileSummary {
  profile: Profile & { user: { email: string } };
  postCount: number;
  followersCount: number;
  followingCount: number;
  groupsFollowedCount: number;
  skillsEntriesCount: number;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly cacheService: CacheService,
  ) {}

  async findByUserId(userId: string, viewerId: string): Promise<ProfileView> {
    const summary = await this.getProfileSummary(userId);
    const isFollowing = await this.profilesRepository.isFollowing(viewerId, userId);

    return {
      userId: summary.profile.userId,
      email: summary.profile.user.email,
      displayName: summary.profile.displayName,
      bio: summary.profile.bio,
      avatarUrl: summary.profile.avatarUrl,
      jobTitle: summary.profile.jobTitle,
      organizationSize: summary.profile.organizationSize,
      createdAt: summary.profile.createdAt.toISOString(),
      updatedAt: summary.profile.updatedAt.toISOString(),
      counters: {
        posts: summary.postCount,
        followers: summary.followersCount,
        following: summary.followingCount,
        groupsFollowed: summary.groupsFollowedCount,
        skillsEntries: summary.skillsEntriesCount,
      },
      relationship: {
        isFollowing,
      },
    };
  }

  async updateMyProfile(userId: string, payload: UpdateProfileDto): Promise<Profile> {
    const existing = await this.profilesRepository.findByUserId(userId);
    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    const updated = await this.profilesRepository.updateByUserId(userId, {
      displayName: payload.displayName,
      bio: payload.bio,
      avatarUrl: payload.avatarUrl,
      jobTitle: payload.jobTitle,
      organizationSize: payload.organizationSize,
    });

    await this.cacheService.deleteByKey(`profile:${userId}`);
    return updated;
  }

  private async getProfileSummary(userId: string): Promise<ProfileSummary> {
    const cacheKey = `profile:${userId}`;
    const cached = await this.cacheService.getJson<ProfileSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    const profile = await this.profilesRepository.findWithUserByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const [postCount, [followersCount, followingCount], groupsFollowedCount] = await Promise.all([
      this.profilesRepository.countPostsByUserId(userId),
      this.profilesRepository.getFollowCounts(userId),
      this.profilesRepository.countGroupsFollowedByUserId(userId),
    ]);

    const summary: ProfileSummary = {
      profile,
      postCount,
      followersCount,
      followingCount,
      groupsFollowedCount,
      skillsEntriesCount: 0,
    };

    await this.cacheService.setJson(cacheKey, summary, 120);
    return summary;
  }
}
