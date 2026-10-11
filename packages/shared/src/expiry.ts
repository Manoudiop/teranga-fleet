import { DocumentStatus } from './enums';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minuit UTC du jour de `date` : les échéances se comparent au jour près. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Nombre de jours entre aujourd'hui et l'échéance (négatif si elle est passée). */
export function daysUntil(expiration: Date, today: Date = new Date()): number {
  return Math.round(
    (startOfUtcDay(expiration).getTime() - startOfUtcDay(today).getTime()) / DAY_MS,
  );
}

/**
 * Statut d'une échéance (document, permis de conduire) :
 * - EXPIRE si la date est passée (le jour même de l'échéance, le document est encore valide) ;
 * - EXPIRANT_BIENTOT si elle tombe dans les `thresholdDays` prochains jours ;
 * - VALIDE sinon.
 */
export function getExpiryStatus(
  expiration: Date | string,
  thresholdDays: number,
  today: Date = new Date(),
): DocumentStatus {
  const days = daysUntil(new Date(expiration), today);
  if (days < 0) return DocumentStatus.EXPIRE;
  if (days <= thresholdDays) return DocumentStatus.EXPIRANT_BIENTOT;
  return DocumentStatus.VALIDE;
}
