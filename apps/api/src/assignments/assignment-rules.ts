import { daysUntil } from '@teranga-fleet/shared';
import type { ApiErrorCode } from '@teranga-fleet/shared';
import type { DriverStatus, VehicleStatus } from '../generated/prisma/enums';

export interface AssignmentCandidate {
  vehicle: { immatriculation: string; statut: VehicleStatus };
  driver: { prenom: string; nom: string; statut: DriverStatus; dateExpirationPermis: Date };
  /** Affectation en cours du véhicule (immatriculation du chauffeur affecté), s'il y en a une. */
  vehicleActiveWith?: string | null;
  /** Affectation en cours du chauffeur (immatriculation du véhicule), s'il y en a une. */
  driverActiveOn?: string | null;
  dateDebut: Date;
  now: Date;
}

export interface RuleViolation {
  error: ApiErrorCode;
  message: string;
}

/** Tolérance sur « maintenant » pour absorber un léger décalage d'horloge du client. */
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Première règle métier qui empêche de créer l'affectation, ou null si elle est possible.
 * Les chevauchements avec l'historique sont vérifiés à part (requête en base).
 */
export function assignmentViolation(c: AssignmentCandidate): RuleViolation | null {
  const driverName = `${c.driver.prenom} ${c.driver.nom}`;

  if (c.dateDebut.getTime() > c.now.getTime() + CLOCK_TOLERANCE_MS) {
    return { error: 'BAD_REQUEST', message: 'La date de début ne peut pas être dans le futur' };
  }
  if (c.vehicle.statut === 'HORS_SERVICE') {
    return {
      error: 'VEHICLE_UNAVAILABLE',
      message: `Le véhicule ${c.vehicle.immatriculation} est hors service et ne peut pas être affecté`,
    };
  }
  if (c.vehicleActiveWith) {
    return {
      error: 'VEHICLE_UNAVAILABLE',
      message: `Le véhicule ${c.vehicle.immatriculation} est déjà affecté à ${c.vehicleActiveWith}`,
    };
  }
  if (c.driver.statut !== 'ACTIF') {
    return {
      error: 'DRIVER_UNAVAILABLE',
      message: `${driverName} n'est pas actif (statut ${c.driver.statut})`,
    };
  }
  if (daysUntil(c.driver.dateExpirationPermis, c.dateDebut) < 0) {
    return {
      error: 'DRIVER_UNAVAILABLE',
      message: `Le permis de ${driverName} est expiré`,
    };
  }
  if (c.driverActiveOn) {
    return {
      error: 'DRIVER_UNAVAILABLE',
      message: `${driverName} conduit déjà le véhicule ${c.driverActiveOn}`,
    };
  }
  return null;
}

/** Vérifie la cohérence d'une période d'affectation. */
export function periodViolation(
  dateDebut: Date,
  dateFin: Date | null,
  now: Date,
): RuleViolation | null {
  const limit = now.getTime() + CLOCK_TOLERANCE_MS;
  if (dateDebut.getTime() > limit) {
    return { error: 'BAD_REQUEST', message: 'La date de début ne peut pas être dans le futur' };
  }
  if (dateFin && dateFin.getTime() > limit) {
    return { error: 'BAD_REQUEST', message: 'La date de fin ne peut pas être dans le futur' };
  }
  if (dateFin && dateFin < dateDebut) {
    return {
      error: 'BAD_REQUEST',
      message: 'La date de fin doit être postérieure à la date de début',
    };
  }
  return null;
}
