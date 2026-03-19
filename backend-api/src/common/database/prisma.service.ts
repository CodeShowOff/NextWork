import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly exportOnlyMode = process.env.OPENAPI_EXPORT_ONLY === 'true';

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/workplace';

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    if (this.exportOnlyMode) {
      return;
    }

    await this.$connect();
  }
}
