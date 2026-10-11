import type { RuleViolation } from '../assignments/assignment-rules';

export interface MileageCandidate {
  kilometrage: number;
  date: Date;
  /** Compteur actuel du véhicule. */
  current: number;
  /** Date du relevé le plus récent du véhicule, s'il y en a un. */
  lastReadingDate: Date | null;
  now: Date;
}

const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

const km = (value: number) => `${value.toLocaleString('fr-FR').replace(/\s/g, ' ')} km`;

/** Règle métier qui empêche d'enregistrer le relevé, ou null s'il est valide. */
export function mileageViolation(c: MileageCandidate): RuleViolation | null {
  if (c.kilometrage < c.current) {
    return {
      error: 'MILEAGE_TOO_LOW',
      message: `Le kilométrage saisi (${km(c.kilometrage)}) est inférieur au kilométrage actuel du véhicule (${km(c.current)})`,
    };
  }
  if (c.date.getTime() > c.now.getTime() + CLOCK_TOLERANCE_MS) {
    return { error: 'BAD_REQUEST', message: 'La date du relevé ne peut pas être dans le futur' };
  }
  if (c.lastReadingDate && c.date < c.lastReadingDate) {
    return {
      error: 'BAD_REQUEST',
      message: 'La date du relevé est antérieure au dernier relevé enregistré pour ce véhicule',
    };
  }
  return null;
}
