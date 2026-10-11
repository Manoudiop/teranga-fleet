import { ParseUUIDPipe } from '@nestjs/common';
import { notFound } from './errors/app.exception';

/**
 * Identifiant de ressource dans l'URL. Un identifiant mal formé est traité
 * comme une ressource introuvable (404), comme un identifiant inconnu.
 */
export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => notFound('Ressource introuvable'),
});
