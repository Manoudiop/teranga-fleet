import type { ApiErrorCode, ApiErrorResponse } from '@teranga-fleet/shared';
import { readToken } from './session';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

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

/**
 * Appelé quand l'API répond 401 (token expiré, compte désactivé, entreprise suspendue) :
 * déconnexion, avec l'erreur pour en afficher la raison.
 */
let onUnauthorized: ((error: ApiError) => void) | null = null;
export function setUnauthorizedHandler(handler: ((error: ApiError) => void) | null) {
  onUnauthorized = handler;
}

type QueryValue = string | number | boolean | undefined | null;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Objet envoyé en JSON, ou FormData (photo d'incident). */
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Token explicite (connexion, tâche d'arrière-plan) au lieu du stockage. */
  token?: string | null;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const token = options.token !== undefined ? options.token : await readToken();
  const isForm = body instanceof FormData;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      'SERVICE_UNAVAILABLE',
      'Connexion impossible. Vérifiez votre réseau et réessayez.',
    );
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = data as Partial<ApiErrorResponse> | null;
    const error = new ApiError(
      response.status,
      body?.error ?? 'INTERNAL_ERROR',
      body?.message ?? 'Une erreur inattendue est survenue.',
      body?.details,
    );
    if (response.status === 401 && token) onUnauthorized?.(error);
    throw error;
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}
