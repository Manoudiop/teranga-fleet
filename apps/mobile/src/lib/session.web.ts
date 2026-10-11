/**
 * Variante web (aperçu de l'application dans un navigateur pendant le
 * développement). Le stockage sécurisé du téléphone n'existe pas sur le web :
 * le token est gardé dans sessionStorage, effacé à la fermeture de l'onglet.
 * L'application des chauffeurs est distribuée sur téléphone, où session.ts
 * (Keychain / Keystore) est utilisé.
 */
export { isExpired, tokenExpiry } from './token-expiry';

const TOKEN_KEY = 'tf.session.token';

export async function readToken(): Promise<string | null> {
  return globalThis.sessionStorage?.getItem(TOKEN_KEY) ?? null;
}

export async function saveToken(token: string): Promise<void> {
  globalThis.sessionStorage?.setItem(TOKEN_KEY, token);
}

export async function deleteToken(): Promise<void> {
  globalThis.sessionStorage?.removeItem(TOKEN_KEY);
}
