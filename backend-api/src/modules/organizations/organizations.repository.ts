import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get orm(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  createOrganizationWithOwner(params: {
    name: string;
    slug: string;
    ownerUserId: string;
  }) {
    return this.orm.organization.create({
      data: {
        name: params.name,
        slug: params.slug,
        createdBy: params.ownerUserId,
        members: {
          create: {
            userId: params.ownerUserId,
            role: 'owner',
          },
        },
      },
    });
  }

  async listByUserId(userId: string): Promise<
    Array<{
      organizationId: string;
      role: string;
      joinedAt: Date;
      organization: {
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        _count: {
          members: number;
          groups: number;
        };
      };
    }>
  > {
    return this.orm.organizationMember.findMany({
      where: {
        userId,
      },
      orderBy: {
        joinedAt: 'asc',
      },
      select: {
        organizationId: true,
        role: true,
        joinedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: {
              select: {
                members: true,
                groups: true,
              },
            },
          },
        },
      },
    });
  }

  setActiveOrganization(userId: string, organizationId: string): Promise<void> {
    return this.orm.user
      .update({
        where: {
          id: userId,
        },
        data: {
          activeOrganizationId: organizationId,
        },
      })
      .then(() => undefined);
  }

  findMembership(userId: string, organizationId: string): Promise<{
    organizationId: string;
    userId: string;
    role: string;
  } | null> {
    return this.orm.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      select: {
        organizationId: true,
        userId: true,
        role: true,
      },
    });
  }

  addMember(params: {
    organizationId: string;
    userId: string;
    role?: string;
  }): Promise<void> {
    return this.orm.organizationMember
      .upsert({
        where: {
          organizationId_userId: {
            organizationId: params.organizationId,
            userId: params.userId,
          },
        },
        create: {
          organizationId: params.organizationId,
          userId: params.userId,
          role: params.role ?? 'member',
        },
        update: {},
      })
      .then(() => undefined);
  }

  findBySlug(slug: string): Promise<{
    id: string;
    name: string;
    slug: string;
  } | null> {
    return this.orm.organization.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  findById(id: string): Promise<{
    id: string;
    name: string;
    slug: string;
  } | null> {
    return this.orm.organization.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  updateOrganization(organizationId: string, payload: { name?: string }): Promise<{
    id: string;
    name: string;
    slug: string;
    updatedAt: Date;
  }> {
    return this.orm.organization.update({
      where: {
        id: organizationId,
      },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
      },
    });
  }

  async deactivateOrganization(organizationId: string): Promise<{
    affectedMembers: number;
    affectedGroups: number;
  }> {
    return this.orm.$transaction(async (tx: unknown) => {
      const transaction = tx as Record<string, any>;

      const [members, groups] = await Promise.all([
        transaction.organizationMember.findMany({
          where: { organizationId },
          select: { userId: true },
        }),
        transaction.group.findMany({
          where: { organizationId },
          select: { id: true },
        }),
      ]);

      const groupIds = groups.map((group: { id: string }) => group.id);
      const memberUserIds = members.map((member: { userId: string }) => member.userId);

      if (groupIds.length > 0) {
        await transaction.post.updateMany({
          where: {
            groupId: {
              in: groupIds,
            },
          },
          data: {
            groupId: null,
          },
        });

        await transaction.group.deleteMany({
          where: {
            id: {
              in: groupIds,
            },
          },
        });
      }

      if (memberUserIds.length > 0) {
        await transaction.user.updateMany({
          where: {
            id: {
              in: memberUserIds,
            },
            activeOrganizationId: organizationId,
          },
          data: {
            activeOrganizationId: null,
          },
        });
      }

      await transaction.organizationMember.deleteMany({
        where: {
          organizationId,
        },
      });

      await transaction.inviteLink.updateMany({
        where: {
          organizationId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return {
        affectedMembers: memberUserIds.length,
        affectedGroups: groupIds.length,
      };
    });
  }

  async deleteOrganizationCascadeSafe(organizationId: string): Promise<{ deletedPostCount: number }> {
    return this.orm.$transaction(async (tx: unknown) => {
      const transaction = tx as Record<string, any>;

      const groups = await transaction.group.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const groupIds = groups.map((group: { id: string }) => group.id);

      let deletedPostCount = 0;
      if (groupIds.length > 0) {
        const deleted = await transaction.post.deleteMany({
          where: {
            groupId: {
              in: groupIds,
            },
          },
        });
        deletedPostCount = deleted.count ?? 0;
      }

      await transaction.user.updateMany({
        where: {
          activeOrganizationId: organizationId,
        },
        data: {
          activeOrganizationId: null,
        },
      });

      await transaction.organization.delete({
        where: {
          id: organizationId,
        },
      });

      return {
        deletedPostCount,
      };
    });
  }
}
