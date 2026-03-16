import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersController Integration', () => {
  let app: INestApplication;

  const usersServiceMock = {
    findById: jest.fn().mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      activeOrganizationId: null,
      status: 'active',
    }),
  };

  const authGuardMock = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'u1',
        email: 'user@example.com',
        type: 'access',
      };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users/me returns current user from service', async () => {
    const response = await request(app.getHttpServer()).get('/users/me').expect(200);

    expect(response.body).toEqual({
      id: 'u1',
      email: 'user@example.com',
      activeOrganizationId: null,
      status: 'active',
    });
    expect(usersServiceMock.findById).toHaveBeenCalledWith('u1');
  });
});
