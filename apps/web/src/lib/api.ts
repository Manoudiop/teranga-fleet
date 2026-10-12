import type { ApiErrorCode, ApiErrorResponse } from '@teranga-fleet/shared';

/** Erreur renvoyée par l'API, avec un message déjà lisible par l'utilisateur. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | undefined | null;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Objet envoyé en JSON, ou FormData pour un upload. */
  body?: unknown;
  query?: Record<string, QueryValue>;
}

/** URL d'une ressource de l'API via le relais Next.js (fichiers, photos). */
export function apiPath(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`;
}

/**
 * Session expirée ou coupée (compte désactivé, entreprise suspendue) : retour à
 * la connexion en conservant la page demandée et la raison à afficher.
 */
function redirectToLogin(reason?: string) {
  if (typeof window === 'undefined' || window.location.pathname === '/login') return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  const why =
    reason === 'ACCOUNT_DISABLED' || reason === 'COMPANY_SUSPENDED' ? `&raison=${reason}` : '';
  // Hors de React (pas de routeur ici) : rechargement complet, qui vide aussi le cache.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}${why}`);
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(apiPath(path, query), {
      method,
      headers: body !== undefined && !isForm ? { 'content-type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(
      0,
      'SERVICE_UNAVAILABLE',
      'Connexion impossible. Vérifiez votre accès internet.',
    );
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = data as Partial<ApiErrorResponse> | null;
    if (response.status === 401 && path !== 'auth/login') redirectToLogin(error?.error);
    throw new ApiError(
      response.status,
      error?.error ?? 'INTERNAL_ERROR',
      error?.message ?? 'Une erreur inattendue est survenue.',
      error?.details,
    );
  }
  return data as T;
}

/** Message affichable pour n'importe quelle erreur. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Une erreur inattendue est survenue.';
}
