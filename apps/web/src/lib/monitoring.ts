/**
 * Suivi des erreurs Sentry côté navigateur. Le SDK n'est téléchargé que si
 * NEXT_PUBLIC_SENTRY_DSN est défini (au build) : sans DSN, aucun coût.
 */
type SentryModule = typeof import('@sentry/nextjs');

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentry: Promise<SentryModule> | null = null;

function load(): Promise<SentryModule> | null {
  if (!dsn) return null;
  sentry ??= import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0,
      // Ni identité, ni cookies, ni en-têtes, ni corps de requête, ni paramètres d'URL.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    });
    return Sentry;
  });
  return sentry;
}

/** Active la capture automatique (erreurs non gérées, promesses rejetées). */
export function initMonitoring(): void {
  void load();
}

/** Erreur attrapée par une page d'erreur React. */
export function captureError(error: unknown): void {
  void load()?.then((Sentry) => Sentry.captureException(error));
}
