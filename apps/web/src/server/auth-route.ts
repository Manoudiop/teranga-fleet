import 'server-only';
import type { LoginResponse } from '@teranga-fleet/shared';
import { NextResponse } from 'next/server';
import { apiUnavailable, apiUrl, forwardedFor, setSession } from './session';

/**
 * Transmet une requête de connexion / inscription à l'API. En cas de succès,
 * le token est placé dans le cookie httpOnly et seul l'utilisateur est renvoyé
 * au navigateur.
 */
export async function forwardAuth(request: Request, apiPath: string): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(apiUrl(apiPath), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...forwardedFor(request) },
      body: await request.text(),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(apiUnavailable(), { status: 503 });
  }

  const body = (await upstream.json()) as LoginResponse | Record<string, unknown>;
  if (!upstream.ok) return NextResponse.json(body, { status: upstream.status });

  const { accessToken, user } = body as LoginResponse;
  const response = NextResponse.json({ user }, { status: upstream.status });
  setSession(response, accessToken);
  return response;
}
