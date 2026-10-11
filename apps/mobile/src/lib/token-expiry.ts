/** Date d'expiration du JWT (claim exp), sans vérifier la signature (rôle de l'API). */
export function tokenExpiry(token: string): Date | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(
      globalThis.atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')),
    ) as { exp?: number };
    return json.exp ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

export function isExpired(token: string, now = new Date()): boolean {
  const expiry = tokenExpiry(token);
  return expiry !== null && expiry.getTime() <= now.getTime();
}
