import type { ApiErrorCode } from '@teranga-fleet/shared';

export interface AccountBlock {
  error: Extract<ApiErrorCode, 'ACCOUNT_DISABLED' | 'COMPANY_SUSPENDED'>;
  message: string;
}

/**
 * Raison pour laquelle un compte ne peut pas utiliser la plateforme, ou null.
 * Vérifiée à la connexion et à chaque requête authentifiée : désactiver un
 * compte ou suspendre une entreprise prend effet immédiatement.
 */
export function accountBlock(
  user: { disabledAt: Date | null },
  company: { suspendedAt: Date | null } | null,
): AccountBlock | null {
  if (user.disabledAt) {
    return {
      error: 'ACCOUNT_DISABLED',
      message: 'Ce compte est désactivé. Contactez votre gestionnaire ou le support.',
    };
  }
  if (company?.suspendedAt) {
    return {
      error: 'COMPANY_SUSPENDED',
      message: "L'accès de votre entreprise à Teranga Fleet est suspendu. Contactez le support.",
    };
  }
  return null;
}

/**
 * Token émis avant la dernière réinitialisation du mot de passe : refusé.
 * `iat` est en secondes ; un token émis dans la même seconde reste valable.
 */
export function sessionRevoked(iat: number | undefined, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return false;
  if (iat === undefined) return true;
  return iat < Math.floor(passwordChangedAt.getTime() / 1000);
}
