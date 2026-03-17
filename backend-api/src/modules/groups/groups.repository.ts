import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

export interface StarterGroupCatalogItem {
  key: string;
  name: string;
  description: string;
}

@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get orm(): PrismaService & Record<string, any> {
    return this.prisma as PrismaService & Record<string, any>;
  }

  private get groupModel(): any {
    return this.orm.group as any;
  }

  private async ensureGroupMetadataColumns(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'Teams & Projects'`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_privacy TEXT NOT NULL DEFAULT 'Open'`,
    );
    await this.prisma.$executeRawUnsafe(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    await this.prisma.$executeRawUnsafe(
      `UPDATE groups SET group_type = 'Teams & Projects' WHERE group_type IS NULL`,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE groups SET group_privacy = 'Open' WHERE group_privacy IS NULL`,
    );
  }

  async listGroups(organizationId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      groupType: string;
      groupPrivacy: string;
      photoUrl: string | null;
      createdAt: Date;
      _count: { members: number };
    }>
  > {
    await this.ensureGroupMetadataColumns();

    return this.groupModel.findMany({
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
        groupType: true,
        groupPrivacy: true,
        photoUrl: true,
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
    groupType: string;
    groupPrivacy: string;
    photoUrl?: string;
  }) {
    return this.ensureGroupMetadataColumns().then(() =>
      this.groupModel.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        description: params.description,
        groupType: params.groupType,
        groupPrivacy: params.groupPrivacy,
        photoUrl: params.photoUrl,
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
        groupType: true,
        groupPrivacy: true,
        photoUrl: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    }),
    );
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

  findOrganizationMembershipWithRole(userId: string, organizationId: string): Promise<{
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

  findGroupById(
    groupId: string,
  ): Promise<{ id: string; organizationId: string; name: string; groupType: string; groupPrivacy: string; photoUrl: string | null } | null> {
    return this.ensureGroupMetadataColumns().then(() =>
      this.groupModel.findUnique({
      where: {
        id: groupId,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        groupType: true,
        groupPrivacy: true,
        photoUrl: true,
      },
    }),
    );
  }

  updateGroup(
    groupId: string,
    payload: { name?: string; description?: string | null; groupType?: string; groupPrivacy?: string; photoUrl?: string | null },
  ): Promise<{
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    groupType: string;
    groupPrivacy: string;
    photoUrl: string | null;
    updatedAt: Date;
  }> {
    return this.ensureGroupMetadataColumns().then(() =>
      this.groupModel.update({
      where: {
        id: groupId,
      },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.groupType !== undefined ? { groupType: payload.groupType } : {}),
        ...(payload.groupPrivacy !== undefined ? { groupPrivacy: payload.groupPrivacy } : {}),
        ...(payload.photoUrl !== undefined ? { photoUrl: payload.photoUrl } : {}),
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        description: true,
        groupType: true,
        groupPrivacy: true,
        photoUrl: true,
        updatedAt: true,
      },
    }),
    );
  }

  async deleteGroupWithPostPolicy(
    groupId: string,
    postPolicy: 'detach' | 'remove',
  ): Promise<{ affectedPosts: number }> {
    return this.orm.$transaction(async (tx: unknown) => {
      const transaction = tx as Record<string, any>;

      const affectedPosts =
        postPolicy === 'remove'
          ? (
              await transaction.post.deleteMany({
                where: {
                  groupId,
                },
              })
            ).count ?? 0
          : (
              await transaction.post.updateMany({
                where: {
                  groupId,
                },
                data: {
                  groupId: null,
                },
              })
            ).count ?? 0;

      await transaction.group.delete({
        where: {
          id: groupId,
        },
      });

      return {
        affectedPosts,
      };
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

  async findGroupByOrganizationAndName(
    organizationId: string,
    name: string,
  ): Promise<{ id: string; name: string; description: string | null; groupType: string; groupPrivacy: string; photoUrl: string | null } | null> {
    await this.ensureGroupMetadataColumns();

    return this.groupModel.findFirst({
      where: {
        organizationId,
        name,
      },
      select: {
        id: true,
        name: true,
        description: true,
        groupType: true,
        groupPrivacy: true,
        photoUrl: true,
      },
    });
  }

  async ensureStarterGroup(params: {
    organizationId: string;
    createdBy: string;
    name: string;
    description: string;
    groupType: string;
    groupPrivacy: string;
    photoUrl?: string;
  }): Promise<{ id: string; name: string }> {
    await this.ensureGroupMetadataColumns();

    const existing = await this.findGroupByOrganizationAndName(params.organizationId, params.name);
    if (existing) {
      await this.joinGroup(params.createdBy, existing.id);
      return {
        id: existing.id,
        name: existing.name,
      };
    }

    const created = await this.groupModel.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        description: params.description,
        groupType: params.groupType,
        groupPrivacy: params.groupPrivacy,
        photoUrl: params.photoUrl,
        createdBy: params.createdBy,
      },
      select: {
        id: true,
        name: true,
      },
    });

    await this.joinGroup(params.createdBy, created.id);
    return created;
  }

  async ensureOnboardingAuditTable(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS organization_onboarding_audits (
        organization_id UUID PRIMARY KEY,
        initialized_by UUID NOT NULL,
        initialized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        skipped BOOLEAN NOT NULL DEFAULT false,
        selected_keys TEXT[] NOT NULL DEFAULT '{}'
      )
    `);
  }

  async getOnboardingAudit(organizationId: string): Promise<{
    organizationId: string;
    initializedBy: string;
    initializedAt: Date;
    skipped: boolean;
    selectedKeys: string[];
  } | null> {
    await this.ensureOnboardingAuditTable();

    const rows = await this.prisma.$queryRaw<
      Array<{
        organizationId: string;
        initializedBy: string;
        initializedAt: Date;
        skipped: boolean;
        selectedKeys: string[];
      }>
    >`
      SELECT
        organization_id AS "organizationId",
        initialized_by AS "initializedBy",
        initialized_at AS "initializedAt",
        skipped,
        selected_keys AS "selectedKeys"
      FROM organization_onboarding_audits
      WHERE organization_id = ${organizationId}::uuid
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async upsertOnboardingAudit(params: {
    organizationId: string;
    initializedBy: string;
    skipped: boolean;
    selectedKeys: string[];
  }): Promise<void> {
    await this.ensureOnboardingAuditTable();

    await this.prisma.$executeRaw`
      INSERT INTO organization_onboarding_audits (
        organization_id,
        initialized_by,
        skipped,
        selected_keys
      ) VALUES (
        ${params.organizationId}::uuid,
        ${params.initializedBy}::uuid,
        ${params.skipped},
        ${params.selectedKeys}::text[]
      )
      ON CONFLICT (organization_id) DO NOTHING
    `;
  }
}
