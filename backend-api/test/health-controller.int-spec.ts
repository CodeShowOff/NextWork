import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '../src/common/database/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import { HealthController } from '../src/health.controller';

describe('HealthController Integration', () => {
  let app: INestApplication;

  const prismaServiceMock = {
    $queryRaw: jest.fn().mockResolvedValue([1]),
  };

  const redisServiceMock = {
    getClient: jest.fn().mockReturnValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: RedisService, useValue: redisServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live reports liveness', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.app).toBe('alive');
  });

  it('GET /health/ready reports dependency readiness', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.postgres).toBe('ok');
    expect(response.body.checks.redis).toBe('ok');
    expect(prismaServiceMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
