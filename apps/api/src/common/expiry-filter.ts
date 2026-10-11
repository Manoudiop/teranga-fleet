import { addDays, startOfUtcDay } from './dates';

/**
 * Filtre Prisma sur une date d'échéance, cohérent avec getExpiryStatus :
 * EXPIRE avant aujourd'hui, EXPIRANT_BIENTOT jusqu'à aujourd'hui + seuil inclus.
 */
export function expiryDateFilter(
  status: 'VALIDE' | 'EXPIRANT_BIENTOT' | 'EXPIRE',
  thresholdDays: number,
  now: Date = new Date(),
) {
  const today = startOfUtcDay(now);
  const limit = addDays(today, thresholdDays);
  switch (status) {
    case 'EXPIRE':
      return { lt: today };
    case 'EXPIRANT_BIENTOT':
      return { gte: today, lte: limit };
    case 'VALIDE':
      return { gt: limit };
  }
}
