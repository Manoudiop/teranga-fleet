/**
 * Énumérations métier partagées. Elles reprennent à l'identique les enums
 * du schéma Prisma de l'API : toute modification doit être faite des deux côtés.
 */

export const Role = {
  ADMIN: 'ADMIN',
  GESTIONNAIRE: 'GESTIONNAIRE',
  CHAUFFEUR: 'CHAUFFEUR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const VehicleStatus = {
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  HORS_SERVICE: 'HORS_SERVICE',
} as const;
export type VehicleStatus = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export const DocumentType = {
  CARTE_GRISE: 'CARTE_GRISE',
  ASSURANCE: 'ASSURANCE',
  VISITE_TECHNIQUE: 'VISITE_TECHNIQUE',
  VIGNETTE: 'VIGNETTE',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

/** Statut calculé (non stocké) d'un document à partir de sa date d'expiration. */
export const DocumentStatus = {
  VALIDE: 'VALIDE',
  EXPIRANT_BIENTOT: 'EXPIRANT_BIENTOT',
  EXPIRE: 'EXPIRE',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const MileageSource = {
  MANUEL: 'MANUEL',
  APP: 'APP',
} as const;
export type MileageSource = (typeof MileageSource)[keyof typeof MileageSource];

export const IncidentType = {
  ACCIDENT: 'ACCIDENT',
  PANNE: 'PANNE',
  PROBLEME_MECANIQUE: 'PROBLEME_MECANIQUE',
  PNEU: 'PNEU',
  AUTRE: 'AUTRE',
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

export const IncidentSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

export const IncidentStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];
