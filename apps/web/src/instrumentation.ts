import type { Instrumentation } from 'next';

/**
 * Suivi des erreurs Sentry côté serveur Next.js (rendu, relais /api, proxy).
 * Sans SENTRY_DSN, le SDK n'est même pas chargé.
 */
const dsn = process.env.SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
    // Ni identité, ni cookies (session), ni en-têtes, ni corps de requête, ni paramètres d'URL.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
