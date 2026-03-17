import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';

describe('OrganizationsController Integration', () => {
  let app: INestApplication;

  const organizationsServiceMock = {
    onboardUser: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
    getMyOrganizations: jest.fn().mockResolvedValue({ items: [] }),
    switchActiveOrganization: jest.fn().mockResolvedValue({ status: 'ok' }),
    updateOrganization: jest.fn().mockResolvedValue({ status: 'ok' }),
    deactivateOrganization: jest.fn().mockResolvedValue({ status: 'ok' }),
    deleteOrganization: jest.fn().mockResolvedValue({ status: 'ok' }),
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
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: organizationsServiceMock }],
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

  it('POST /organizations/onboard creates organization', async () => {
    const payload = { name: 'Team Alpha' };

    await request(app.getHttpServer()).post('/organizations/onboard').send(payload).expect(201);

    expect(organizationsServiceMock.onboardUser).toHaveBeenCalledWith('u1', payload);
  });

  it('GET /organizations/me lists memberships', async () => {
    await request(app.getHttpServer()).get('/organizations/me').expect(200);

    expect(organizationsServiceMock.getMyOrganizations).toHaveBeenCalledWith('u1');
  });

  it('POST /organizations/:id/switch switches organization', async () => {
    await request(app.getHttpServer()).post('/organizations/org-1/switch').expect(201);

    expect(organizationsServiceMock.switchActiveOrganization).toHaveBeenCalledWith('u1', 'org-1');
  });

  it('PATCH /organizations/:id updates organization details', async () => {
    const payload = {
      name: 'Team Alpha Updated',
      description: 'Updated details',
    };

    await request(app.getHttpServer()).patch('/organizations/org-1').send(payload).expect(200);

    expect(organizationsServiceMock.updateOrganization).toHaveBeenCalledWith('u1', 'org-1', payload);
  });

  it('POST /organizations/:id/deactivate deactivates organization', async () => {
    await request(app.getHttpServer()).post('/organizations/org-1/deactivate').expect(201);

    expect(organizationsServiceMock.deactivateOrganization).toHaveBeenCalledWith('u1', 'org-1');
  });

  it('DELETE /organizations/:id deletes organization', async () => {
    await request(app.getHttpServer()).delete('/organizations/org-1').expect(200);

    expect(organizationsServiceMock.deleteOrganization).toHaveBeenCalledWith('u1', 'org-1');
  });
});
