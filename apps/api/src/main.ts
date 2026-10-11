import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import type { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    // Sans liste explicite, toutes les origines sont acceptées hors production
    // (la validation de l'environnement impose la liste en production).
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.enableShutdownHooks();
  setupApp(app);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API démarrée sur http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
