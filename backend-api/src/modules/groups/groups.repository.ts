import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get orm(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  listGroups(organizationId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      _count: { members: number };
    }>
  > {
    return this.orm.group.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
  }

  createGroup(params: {
    organizationId: string;
    createdBy: string;
    name: string;
    description?: string;
  }) {
    return this.orm.group.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        description: params.description,
        createdBy: params.createdBy,
        members: {
          create: {
            userId: params.createdBy,
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
  }

  async findOrganizationMembership(userId: string, organizationId: string): Promise<boolean> {
    const row = await this.orm.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      select: {
        userId: true,
      },
    });

    return Boolean(row);
  }

  findGroupById(groupId: string): Promise<{ id: string; organizationId: string; name: string } | null> {
    return this.orm.group.findUnique({
      where: {
        id: groupId,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
      },
    });
  }

  joinGroup(userId: string, groupId: string): Promise<void> {
    return this.orm.groupMember
      .upsert({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
        create: {
          groupId,
          userId,
        },
        update: {},
      })
      .then(() => undefined);
  }

  listMembers(groupId: string): Promise<
    Array<{
      userId: string;
      joinedAt: Date;
      user: {
        profile: {
          displayName: string;
          avatarUrl: string | null;
        } | null;
      };
    }>
  > {
    return this.orm.groupMember.findMany({
      where: {
        groupId,
      },
      orderBy: {
        joinedAt: 'asc',
      },
      select: {
        userId: true,
        joinedAt: true,
        user: {
          select: {
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }
}
