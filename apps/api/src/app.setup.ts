import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { validationExceptionFactory } from './common/errors/validation';

/**
 * Configuration globale de l'application, partagée entre main.ts et les tests
 * e2e pour que les tests tournent dans les mêmes conditions que la production.
 */
export function setupApp(app: INestApplication): void {
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
