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

  async findGroupByOrganizationAndName(
    organizationId: string,
    name: string,
  ): Promise<{ id: string; name: string; description: string | null } | null> {
    return this.orm.group.findFirst({
      where: {
        organizationId,
        name,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }

  async ensureStarterGroup(params: {
    organizationId: string;
    createdBy: string;
    name: string;
    description: string;
  }): Promise<{ id: string; name: string }> {
    const existing = await this.findGroupByOrganizationAndName(params.organizationId, params.name);
    if (existing) {
      await this.joinGroup(params.createdBy, existing.id);
      return {
        id: existing.id,
        name: existing.name,
      };
    }

    const created = await this.orm.group.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        description: params.description,
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
