import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class InvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get orm(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  findOrganizationMembership(userId: string, organizationId: string): Promise<{
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
        role: true,
      },
    });
  }

  createInvite(params: {
    organizationId: string;
    createdBy: string;
    token: string;
    maxUses?: number;
    expiresAt?: Date;
  }) {
    return this.orm.inviteLink.create({
      data: {
        organizationId: params.organizationId,
        createdBy: params.createdBy,
        token: params.token,
        maxUses: params.maxUses,
        expiresAt: params.expiresAt,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  findByToken(token: string) {
    return this.orm.inviteLink.findUnique({
      where: {
        token,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async acceptInvite(params: {
    token: string;
    userId: string;
  }): Promise<{ organizationId: string; alreadyMember: boolean }> {
    return this.orm.$transaction(async (tx: unknown) => {
      const transaction = tx as Record<string, any>;

      const invite = await transaction.inviteLink.findUnique({
        where: {
          token: params.token,
        },
      });

      if (!invite) {
        throw new Error('INVITE_NOT_FOUND');
      }

      const existingMembership = await transaction.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: params.userId,
          },
        },
      });

      if (existingMembership) {
        await transaction.user.update({
          where: { id: params.userId },
          data: { activeOrganizationId: invite.organizationId },
        });

        return {
          organizationId: invite.organizationId,
          alreadyMember: true,
        };
      }

      await transaction.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: params.userId,
          role: 'member',
        },
      });

      await transaction.user.update({
        where: {
          id: params.userId,
        },
        data: {
          activeOrganizationId: invite.organizationId,
        },
      });

      await transaction.inviteLink.update({
        where: {
          id: invite.id,
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

      const defaultGroup = await transaction.group.findFirst({
        where: {
          organizationId: invite.organizationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
        },
      });

      if (defaultGroup) {
        await transaction.groupMember.upsert({
          where: {
            groupId_userId: {
              groupId: defaultGroup.id,
              userId: params.userId,
            },
          },
          create: {
            groupId: defaultGroup.id,
            userId: params.userId,
          },
          update: {},
        });
      }

      return {
        organizationId: invite.organizationId,
        alreadyMember: false,
      };
    });
  }

  revokeInvite(inviteId: string): Promise<void> {
    return this.orm.inviteLink
      .update({
        where: { id: inviteId },
        data: {
          revokedAt: new Date(),
        },
      })
      .then(() => undefined);
  }
}
