import { daysUntil } from '@teranga-fleet/shared';

export interface MaintenanceDueInput {
  id: string;
  vehicleId: string;
  type: string;
  date: Date;
  createdAt: Date;
  prochainEntretienKm: number | null;
  prochainEntretienDate: Date | null;
}

export type DueLevel = 'OVERDUE' | 'SOON';

export interface MaintenanceDue {
  maintenanceId: string;
  vehicleId: string;
  type: string;
  level: DueLevel;
  /** Échéance kilométrique, si elle est atteinte ou proche. */
  km: { due: number; current: number; remaining: number; level: DueLevel } | null;
  /** Échéance calendaire, si elle est dépassée ou proche. */
  date: { due: Date; daysRemaining: number; level: DueLevel } | null;
}

export interface DueOptions {
  today: Date;
  /** Jours avant la date prévue à partir desquels l'entretien est « à prévoir ». */
  thresholdDays: number;
  /** Kilomètres avant l'échéance à partir desquels l'entretien est « à prévoir ». */
  kmMargin: number;
}

/** « Vidange », « vidange » et « Vidange  » désignent le même type d'entretien. */
export function normalizeMaintenanceType(type: string): string {
  // NFD sépare les lettres de leurs accents (\p{M}), qui sont ensuite retirés.
  return type.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Entretiens à prévoir ou dépassés.
 *
 * Seul le dernier entretien de chaque type, par véhicule, fixe l'échéance :
 * une vidange plus récente remplace l'échéance de la précédente, sans masquer
 * l'échéance d'une révision restée en attente.
 *
 * - kilométrage : dépassé si kilometrageActuel >= prochainEntretienKm,
 *   à prévoir si l'écart est inférieur ou égal à `kmMargin` ;
 * - date : dépassée si prochainEntretienDate < aujourd'hui,
 *   à prévoir si elle tombe d'ici `thresholdDays` jours (inclus).
 */
export function computeMaintenanceDue(
  records: MaintenanceDueInput[],
  vehicleKm: ReadonlyMap<string, number>,
  { today, thresholdDays, kmMargin }: DueOptions,
): MaintenanceDue[] {
  const latest = new Map<string, MaintenanceDueInput>();
  for (const record of records) {
    const key = `${record.vehicleId}|${normalizeMaintenanceType(record.type)}`;
    const current = latest.get(key);
    const isNewer =
      !current ||
      record.date.getTime() > current.date.getTime() ||
      (record.date.getTime() === current.date.getTime() &&
        record.createdAt.getTime() > current.createdAt.getTime());
    if (isNewer) latest.set(key, record);
  }

  const result: MaintenanceDue[] = [];
  for (const record of latest.values()) {
    const currentKm = vehicleKm.get(record.vehicleId);

    let km: MaintenanceDue['km'] = null;
    if (record.prochainEntretienKm !== null && currentKm !== undefined) {
      const remaining = record.prochainEntretienKm - currentKm;
      if (remaining <= kmMargin) {
        km = {
          due: record.prochainEntretienKm,
          current: currentKm,
          remaining,
          level: remaining <= 0 ? 'OVERDUE' : 'SOON',
        };
      }
    }

    let date: MaintenanceDue['date'] = null;
    if (record.prochainEntretienDate) {
      const daysRemaining = daysUntil(record.prochainEntretienDate, today);
      if (daysRemaining <= thresholdDays) {
        date = {
          due: record.prochainEntretienDate,
          daysRemaining,
          level: daysRemaining < 0 ? 'OVERDUE' : 'SOON',
        };
      }
    }

    if (km || date) {
      result.push({
        maintenanceId: record.id,
        vehicleId: record.vehicleId,
        type: record.type,
        level: km?.level === 'OVERDUE' || date?.level === 'OVERDUE' ? 'OVERDUE' : 'SOON',
        km,
        date,
      });
    }
  }
  return result;
}
