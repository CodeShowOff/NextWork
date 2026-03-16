import { Injectable } from '@nestjs/common';

import { UserRecord, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<UserRecord | null> {
    return this.usersRepository.findById(id);
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.usersRepository.findByEmail(email.toLowerCase());
  }

  async createUser(params: {
    email: string;
    passwordHash: string;
    displayName: string;
  }): Promise<UserRecord> {
    const normalizedEmail = params.email.toLowerCase();

    return this.usersRepository.create({
      email: normalizedEmail,
      passwordHash: params.passwordHash,
      profile: {
        create: {
          displayName: params.displayName,
        },
      },
    }) as unknown as Promise<UserRecord>;
  }

  updateRefreshTokenHash(userId: string, refreshTokenHash: string | null): Promise<void> {
    return this.usersRepository.updateRefreshTokenHash(userId, refreshTokenHash);
  }
}
