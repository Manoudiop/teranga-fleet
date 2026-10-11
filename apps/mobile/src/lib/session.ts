import * as SecureStore from 'expo-secure-store';

export { isExpired, tokenExpiry } from './token-expiry';

const TOKEN_KEY = 'tf.session.token';

/**
 * Le JWT est conservé dans le stockage sécurisé du téléphone (Keychain iOS,
 * Keystore Android). AFTER_FIRST_UNLOCK : la tâche de localisation en
 * arrière-plan doit pouvoir le lire écran verrouillé, après le premier
 * déverrouillage suivant un redémarrage.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY, OPTIONS);
}

export function saveToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token, OPTIONS);
}

export function deleteToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS);
}
