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
    organizationName?: string;
    organizationSize?: string;
    jobTitle?: string;
  }): Promise<UserRecord> {
    const normalizedEmail = params.email.toLowerCase();

    return this.usersRepository.createWithOnboarding({
      email: normalizedEmail,
      passwordHash: params.passwordHash,
      displayName: params.displayName,
      organizationName: params.organizationName,
      organizationSize: params.organizationSize,
      jobTitle: params.jobTitle,
    });
  }

  updateRefreshTokenHash(userId: string, refreshTokenHash: string | null): Promise<void> {
    return this.usersRepository.updateRefreshTokenHash(userId, refreshTokenHash);
  }
}
