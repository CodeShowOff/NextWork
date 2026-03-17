import { writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../app.module';

function ensureEnvDefaults(): void {
  process.env.NODE_ENV ??= 'test';
  process.env.PORT ??= '4000';
  process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/workplace';
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(32);
  process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
  process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';
  process.env.OPENAPI_EXPORT_ONLY = 'true';
}

async function run(): Promise<void> {
  ensureEnvDefaults();

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

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
  const outputPath = resolve(__dirname, '../../../packages/api-contracts/openapi/workplace.openapi.json');

  await mkdir(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`Exported OpenAPI document to ${outputPath}`);
}

run().catch((error) => {
  console.error('OpenAPI export failed:', error);
  process.exit(1);
});
