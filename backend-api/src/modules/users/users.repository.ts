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

  async updateRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE users
      SET refresh_token_hash = ${refreshTokenHash}
      WHERE id = ${id}::uuid
    `;
  }
}
