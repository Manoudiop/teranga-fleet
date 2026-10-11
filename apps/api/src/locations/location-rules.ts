export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  recordedAt: Date;
}

export interface PointFilterOptions {
  now: Date;
  /** Début de l'affectation en cours : un point antérieur ne concerne pas ce véhicule. */
  assignmentStart: Date;
  /** Âge maximal d'un point envoyé en différé (file hors ligne du téléphone). */
  maxAgeDays: number;
}

const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Précision au-delà de laquelle un point GPS est inexploitable (antenne relais seule). */
export const MAX_ACCURACY_M = 2_000;

/**
 * Sépare les points enregistrables des points à écarter : dans le futur, trop
 * anciens, antérieurs à l'affectation en cours, ou trop imprécis. Un point
 * écarté ne fait pas échouer le lot : le téléphone vide sa file et passe à la suite.
 */
export function filterLocationPoints<T extends LocationPoint>(
  points: T[],
  { now, assignmentStart, maxAgeDays }: PointFilterOptions,
): { accepted: T[]; rejected: number } {
  const latest = now.getTime() + CLOCK_TOLERANCE_MS;
  const oldest = Math.max(now.getTime() - maxAgeDays * DAY_MS, assignmentStart.getTime());

  const accepted = points.filter((p) => {
    const t = p.recordedAt.getTime();
    return (
      Number.isFinite(t) &&
      t <= latest &&
      t >= oldest &&
      (p.accuracy === undefined || p.accuracy <= MAX_ACCURACY_M)
    );
  });
  return { accepted, rejected: points.length - accepted.length };
}
