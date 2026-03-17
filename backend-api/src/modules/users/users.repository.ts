import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  refreshTokenHash: string | null;
  activeOrganizationId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.prisma.$queryRaw<UserRecord[]>`
      SELECT id, email, password_hash AS "passwordHash", refresh_token_hash AS "refreshTokenHash", active_organization_id AS "activeOrganizationId", status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.prisma.$queryRaw<UserRecord[]>`
      SELECT id, email, password_hash AS "passwordHash", refresh_token_hash AS "refreshTokenHash", active_organization_id AS "activeOrganizationId", status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createWithOnboarding(params: {
    email: string;
    passwordHash: string;
    displayName: string;
    organizationName?: string;
    organizationSize?: string;
    jobTitle?: string;
  }): Promise<UserRecord> {
    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: params.email,
          passwordHash: params.passwordHash,
          profile: {
            create: {
              displayName: params.displayName,
              organizationSize: params.organizationSize || null,
              jobTitle: params.jobTitle || null,
            },
          },
        },
      });

      const organizationName = params.organizationName?.trim();
      if (!organizationName) {
        return user;
      }

      const slug = await this.generateUniqueOrganizationSlug(tx, organizationName);
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          createdBy: user.id,
          members: {
            create: {
              userId: user.id,
              role: 'owner',
            },
          },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { activeOrganizationId: organization.id },
      });

      return user;
    });

    const hydrated = await this.findById(createdUser.id);
    if (!hydrated) {
      throw new Error('User was created but could not be loaded');
    }

    return hydrated;
  }

  async updateRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE users
      SET refresh_token_hash = ${refreshTokenHash}
      WHERE id = ${id}::uuid
    `;
  }

  private async generateUniqueOrganizationSlug(
    tx: Prisma.TransactionClient,
    organizationName: string,
  ): Promise<string> {
    const base = this.toSlug(organizationName);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const slug = `${base}-${suffix}`;
      const existing = await tx.organization.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }
    }

    throw new Error('Could not generate a unique organization slug');
  }

  private toSlug(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32) || 'organization'
    );
  }
}
