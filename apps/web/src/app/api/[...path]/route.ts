import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  apiUnavailable,
  apiUrl,
  clearSession,
  forwardedFor,
} from '@/server/session';

/**
 * Relais authentifié vers l'API NestJS (« backend for frontend ») : le
 * navigateur appelle /api/<chemin>, le serveur Next ajoute le JWT lu dans le
 * cookie httpOnly. Le token n'est donc jamais accessible au JavaScript.
 */

const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'content-length'];

function errorResponse(status: number, error: string, message: string) {
  return NextResponse.json({ statusCode: status, error, message }, { status });
}

/** Les écritures doivent venir de l'application elle-même (protection CSRF). */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !origin || new URL(origin).host === request.headers.get('host');
}

const RELAYED_AUTH_ROUTES = new Set([
  'auth/me',
  'auth/password',
  'auth/forgot-password',
  'auth/reset-password',
  'auth/preferences',
]);

async function relay(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = path.join('/');

  // Connexion et inscription passent par /api/auth/login|register, qui posent le cookie :
  // le relais ne doit jamais renvoyer un token au navigateur. Seules les routes auth qui
  // n'en émettent pas sont relayées.
  if (target.startsWith('auth/') && !RELAYED_AUTH_ROUTES.has(target)) {
    return errorResponse(404, 'NOT_FOUND', 'Ressource introuvable');
  }
  if (request.method !== 'GET' && !isSameOrigin(request)) {
    return errorResponse(403, 'FORBIDDEN', 'Requête refusée');
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers(forwardedFor(request));
  if (token) headers.set('authorization', `Bearer ${token}`);
  for (const name of ['content-type', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl(target)}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Corps transmis en flux (uploads) sans être chargé en mémoire.
      ...(hasBody && { duplex: 'half' }),
      cache: 'no-store',
      redirect: 'manual',
    } as RequestInit);
  } catch {
    return NextResponse.json(apiUnavailable(), { status: 503 });
  }

  const responseHeaders = new Headers({ 'cache-control': 'no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  // Token expiré ou compte supprimé : la session est effacée.
  if (upstream.status === 401 && token) clearSession(response);
  return response;
}

export { relay as DELETE, relay as GET, relay as PATCH, relay as POST, relay as PUT };
