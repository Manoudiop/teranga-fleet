/**
 * Initialisation de Sentry : importé en tout premier par main.ts, pour que
 * l'instrumentation soit en place avant le chargement des autres modules.
 * Sans SENTRY_DSN, Sentry reste inactif.
 */
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Erreurs uniquement : pas de suivi des performances par défaut.
    tracesSampleRate: 0,
    // Données personnelles exclues : ni identité, ni cookies, ni en-têtes, ni corps
    // de requête (mots de passe), ni paramètres d'URL.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
}
