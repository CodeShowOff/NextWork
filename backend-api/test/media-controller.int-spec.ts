import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { MediaController } from '../src/modules/media/media.controller';
import { MediaService } from '../src/modules/media/media.service';

describe('MediaController Integration', () => {
  let app: INestApplication;

  const mediaServiceMock = {
    createUploadContract: jest.fn().mockResolvedValue({
      objectKey: 'uploads/u1/object.jpg',
      uploadUrl: 'https://uploads.workplace.local/uploads/u1/object.jpg',
      publicUrl: 'https://cdn.workplace.local/uploads/u1/object.jpg',
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      expiresInSeconds: 900,
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
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mediaServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /media/uploads/presign returns upload contract for valid payload', async () => {
    const payload = {
      fileName: 'profile-photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    };

    const response = await request(app.getHttpServer()).post('/media/uploads/presign').send(payload).expect(201);

    expect(response.body.method).toBe('PUT');
    expect(mediaServiceMock.createUploadContract).toHaveBeenCalledWith('u1', payload);
  });

  it('POST /media/uploads/presign accepts video upload contract payload', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads/presign')
      .send({
        fileName: 'clip.mp4',
        contentType: 'video/mp4',
        sizeBytes: 5 * 1024 * 1024,
      })
      .expect(201);
  });

  it('POST /media/uploads/presign accepts pdf upload contract payload', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads/presign')
      .send({
        fileName: 'manual.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2 * 1024 * 1024,
      })
      .expect(201);
  });

  it('POST /media/uploads/presign rejects invalid content type', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads/presign')
      .send({
        fileName: 'profile-photo.gif',
        contentType: 'image/gif',
      })
      .expect(400);
  });

  it('POST /media/uploads/presign rejects oversized upload request', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads/presign')
      .send({
        fileName: 'profile-photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 51 * 1024 * 1024,
      })
      .expect(400);
  });

  it('POST /media/uploads/presign rejects unsafe filename characters', async () => {
    await request(app.getHttpServer())
      .post('/media/uploads/presign')
      .send({
        fileName: '../profile-photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });
});
