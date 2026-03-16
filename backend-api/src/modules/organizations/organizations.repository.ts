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
        groups: {
          create: [
            {
              name: 'General',
              description: 'Default space for team discussions.',
              createdBy: params.ownerUserId,
            },
            {
              name: 'Announcements',
              description: 'Important updates for everyone.',
              createdBy: params.ownerUserId,
            },
          ],
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
}
