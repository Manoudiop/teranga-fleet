import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Teranga Fleet API')
        .setDescription(
          'API de gestion de flotte multi-tenant. Authentifiez-vous via POST /auth/login ' +
            'puis cliquez sur « Authorize » avec le token obtenu.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API démarrée sur http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
