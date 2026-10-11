import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'tf_session';
const PUBLIC_PAGES = ['/login', '/register'];

/**
 * Redirige vers /login toute page protégée visitée sans session, et vers le
 * tableau de bord une page de connexion visitée avec une session. La validité
 * du token est vérifiée par l'API à chaque appel (un 401 efface le cookie).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PAGES.some((page) => pathname === page);

  if (!hasSession && !isPublic) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (hasSession && (isPublic || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages uniquement : ni les routes /api (qui répondent en JSON), ni les fichiers statiques.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)'],
};
