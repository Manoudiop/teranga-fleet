import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuration globale de l'application, partagée entre main.ts et les tests
 * e2e pour que les tests tournent dans les mêmes conditions que la production.
 */
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
