import type { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

/**
 * Erreur inattendue : journalisée et transmise à Sentry (sans effet si Sentry
 * n'est pas configuré). Pour les requêtes HTTP en 500 et les tâches de fond.
 */
export function reportError(logger: Logger, context: string, error: unknown): void {
  logger.error(
    `${context} : ${error instanceof Error ? error.message : String(error)}`,
    error instanceof Error ? error.stack : undefined,
  );
  Sentry.captureException(error, { tags: { context } });
}
