import 'server-only';
import type { NextResponse } from 'next/server';

/** Cookie httpOnly qui porte le JWT de l'API : jamais lisible par le JavaScript du navigateur. */
export const SESSION_COOKIE = 'tf_session';

export function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error('API_URL manquante (voir apps/web/.env.example)');
  return new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`).toString();
}

/** Date d'expiration lue dans le JWT (claim exp), pour aligner la durée du cookie. */
function tokenExpiry(token: string): Date | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
      exp?: number;
    };
    return payload.exp ? new Date(payload.exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}

export function setSession(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: tokenExpiry(token),
  });
}

export function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/**
 * IP du navigateur, transmise à l'API pour que sa limitation de débit vise le
 * vrai client et non le serveur Next.js (l'API fait confiance à ce relais via TRUST_PROXY).
 */
export function forwardedFor(request: Request): Record<string, string> {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  return ip ? { 'x-forwarded-for': ip } : {};
}

/** Réponse d'erreur au format de l'API quand celle-ci est injoignable. */
export function apiUnavailable() {
  return {
    statusCode: 503,
    error: 'SERVICE_UNAVAILABLE',
    message: 'Le serveur est momentanément injoignable. Réessayez dans quelques instants.',
  };
}
