import { Injectable } from '@nestjs/common';
import { Prisma, Profile } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  findWithUserByUserId(userId: string): Promise<(Profile & { user: { email: string } }) | null> {
    return this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  updateByUserId(userId: string, data: Prisma.ProfileUpdateInput): Promise<Profile> {
    return this.prisma.profile.update({ where: { userId }, data });
  }

  getFollowCounts(userId: string): Promise<[number, number]> {
    return Promise.all([
      this.prisma.follow.count({ where: { followeeId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
  }

  isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    if (followerId === followeeId) {
      return Promise.resolve(false);
    }

    return this.prisma.follow
      .findUnique({
        where: {
          followerId_followeeId: {
            followerId,
            followeeId,
          },
        },
      })
      .then((row) => Boolean(row));
  }

  countPostsByUserId(userId: string): Promise<number> {
    return this.prisma.post.count({ where: { authorId: userId } });
  }

  countGroupsFollowedByUserId(userId: string): Promise<number> {
    return this.prisma.groupMember.count({ where: { userId } });
  }

  listSkillsByUserId(userId: string) {
    return this.prisma.profileSkill.findMany({
      where: { profileUserId: userId },
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, normalizedName: true },
    });
  }

  async replaceSkills(userId: string, skills: Array<{ name: string; normalizedName: string }>) {
    await this.prisma.$transaction([
      this.prisma.profileSkill.deleteMany({ where: { profileUserId: userId } }),
      ...skills.map((skill) =>
        this.prisma.profileSkill.create({
          data: {
            profileUserId: userId,
            name: skill.name,
            normalizedName: skill.normalizedName,
          },
        }),
      ),
    ]);
    return this.listSkillsByUserId(userId);
  }

  searchSkills(query: string) {
    return this.prisma.profileSkill.findMany({
      where: { normalizedName: { startsWith: query } },
      distinct: ['normalizedName'],
      orderBy: [{ normalizedName: 'asc' }],
      take: 20,
      select: { name: true, normalizedName: true },
    });
  }
}
