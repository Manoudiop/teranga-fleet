import type { Alert } from '@teranga-fleet/shared';

export interface DigestItem extends Alert {
  /** Absente du récapitulatif précédent. */
  isNew: boolean;
}

/**
 * Alertes reprises dans le récapitulatif : critiques et à surveiller, dans
 * l'ordre de priorité de buildAlerts. Sans récapitulatif précédent, rien
 * n'est marqué « nouveau » (tout le serait).
 */
export function digestItems(
  alerts: Alert[],
  previousIds: ReadonlySet<string> | null,
): DigestItem[] {
  return alerts
    .filter((a) => a.severity === 'CRITICAL' || a.severity === 'WARNING')
    .map((a) => ({ ...a, isNew: previousIds !== null && !previousIds.has(a.id) }));
}

/** Jour UTC (minuit) d'une date : clé du récapitulatif d'une journée. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Prochaine exécution à `hour` heures UTC, strictement après `now`. */
export function nextRunAt(now: Date, hour: number): Date {
  const today = new Date(utcDay(now).getTime() + hour * 3_600_000);
  return today > now ? today : new Date(today.getTime() + 24 * 3_600_000);
}
