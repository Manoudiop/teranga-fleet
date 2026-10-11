import type {
  AlertSeverity,
  DocumentStatus,
  DocumentType,
  DriverStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MileageSource,
  VehicleStatus,
} from '@teranga-fleet/shared';

/** Teinte d'un badge de statut. */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface Label {
  label: string;
  tone: Tone;
}

export const VEHICLE_STATUS: Record<VehicleStatus, Label> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  MAINTENANCE: { label: 'En maintenance', tone: 'warning' },
  HORS_SERVICE: { label: 'Hors service', tone: 'danger' },
};

export const DRIVER_STATUS: Record<DriverStatus, Label> = {
  ACTIF: { label: 'Actif', tone: 'success' },
  INACTIF: { label: 'Inactif', tone: 'neutral' },
  SUSPENDU: { label: 'Suspendu', tone: 'danger' },
};

export const EXPIRY_STATUS: Record<DocumentStatus, Label> = {
  VALIDE: { label: 'Valide', tone: 'success' },
  EXPIRANT_BIENTOT: { label: 'Expire bientôt', tone: 'warning' },
  EXPIRE: { label: 'Expiré', tone: 'danger' },
};

export const DOCUMENT_TYPE: Record<DocumentType, string> = {
  CARTE_GRISE: 'Carte grise',
  ASSURANCE: 'Assurance',
  VISITE_TECHNIQUE: 'Visite technique',
  VIGNETTE: 'Vignette',
};

export const INCIDENT_TYPE: Record<IncidentType, string> = {
  ACCIDENT: 'Accident',
  PANNE: 'Panne',
  PROBLEME_MECANIQUE: 'Problème mécanique',
  PNEU: 'Pneu',
  AUTRE: 'Autre',
};

export const INCIDENT_SEVERITY: Record<IncidentSeverity, Label> = {
  LOW: { label: 'Faible', tone: 'neutral' },
  MEDIUM: { label: 'Moyenne', tone: 'info' },
  HIGH: { label: 'Élevée', tone: 'warning' },
  CRITICAL: { label: 'Critique', tone: 'danger' },
};

export const INCIDENT_STATUS: Record<IncidentStatus, Label> = {
  OPEN: { label: 'Ouvert', tone: 'danger' },
  IN_PROGRESS: { label: 'En cours', tone: 'warning' },
  RESOLVED: { label: 'Résolu', tone: 'success' },
};

export const ALERT_SEVERITY: Record<AlertSeverity, Label> = {
  CRITICAL: { label: 'Critique', tone: 'danger' },
  WARNING: { label: 'Attention', tone: 'warning' },
  INFO: { label: 'Info', tone: 'info' },
};

export const MILEAGE_SOURCE: Record<MileageSource, string> = {
  APP: 'Application chauffeur',
  MANUEL: 'Saisie manuelle',
};

/** Options d'un <select> à partir d'un dictionnaire de libellés. */
export function options<K extends string>(labels: Record<K, string | Label>) {
  return (Object.entries(labels) as [K, string | Label][]).map(([value, l]) => ({
    value,
    label: typeof l === 'string' ? l : l.label,
  }));
}
