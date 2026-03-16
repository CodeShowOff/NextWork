import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { RedisService } from './common/redis/redis.service';
import { RedisIoAdapter } from './common/realtime/redis-io.adapter';
import { ApiResponseInterceptor } from './common/http/api-response.interceptor';
import { GlobalExceptionFilter } from './common/http/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const redisService = app.get(RedisService);
  app.useWebSocketAdapter(new RedisIoAdapter(app, redisService));
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const openApiConfig = new DocumentBuilder()
    .setTitle('Workplace API')
    .setDescription('Workplace backend API documentation')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api/docs', app, openApiDocument);

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
