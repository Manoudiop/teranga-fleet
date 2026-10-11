import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import type { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    // Sans liste explicite, toutes les origines sont acceptées hors production
    // (la validation de l'environnement impose la liste en production).
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  // IP réelle du client derrière le relais Next.js ou un reverse proxy (limitation de débit).
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
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
        // Ordre d'affichage des sections dans Swagger UI.
        .addTag('Auth', 'Inscription, connexion, profil')
        .addTag('Vehicles', 'Véhicules de la flotte')
        .addTag('Drivers', 'Chauffeurs et comptes mobiles')
        .addTag('Documents', 'Carte grise, assurance, visite technique, vignette')
        .addTag('Maintenance', 'Entretiens et échéances')
        .addTag('Assignments', 'Affectations chauffeur / véhicule')
        .addTag('Mileage', 'Relevés kilométriques')
        .addTag('Incidents', 'Signalements et traitement')
        .addTag('Alerts', 'Alertes de la flotte')
        .addTag('Dashboard', 'Indicateurs du gestionnaire')
        .addTag('Admin', 'Administration de la plateforme (rôle ADMIN)')
        .addTag('Health', "État de l'API")
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
