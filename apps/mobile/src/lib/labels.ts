import type {
  AlertSeverity,
  DocumentStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  VehicleStatus,
} from '@teranga-fleet/shared';
import { colors } from '@/theme';

export interface Tone {
  label: string;
  color: string;
  background: string;
}

const tone = (label: string, color: string, background: string): Tone => ({
  label,
  color,
  background,
});

export const VEHICLE_STATUS: Record<VehicleStatus, Tone> = {
  ACTIVE: tone('Actif', colors.success, colors.successSoft),
  MAINTENANCE: tone('En maintenance', colors.warning, colors.warningSoft),
  HORS_SERVICE: tone('Hors service', colors.danger, colors.dangerSoft),
};

export const EXPIRY_STATUS: Record<DocumentStatus, Tone> = {
  VALIDE: tone('Valide', colors.success, colors.successSoft),
  EXPIRANT_BIENTOT: tone('Expire bientôt', colors.warning, colors.warningSoft),
  EXPIRE: tone('Expiré', colors.danger, colors.dangerSoft),
};

export const INCIDENT_STATUS: Record<IncidentStatus, Tone> = {
  OPEN: tone('Ouvert', colors.danger, colors.dangerSoft),
  IN_PROGRESS: tone('En cours', colors.warning, colors.warningSoft),
  RESOLVED: tone('Résolu', colors.success, colors.successSoft),
};

export const INCIDENT_SEVERITY: Record<IncidentSeverity, Tone> = {
  LOW: tone('Faible', colors.textMuted, colors.background),
  MEDIUM: tone('Moyenne', colors.info, colors.infoSoft),
  HIGH: tone('Élevée', colors.warning, colors.warningSoft),
  CRITICAL: tone('Critique', colors.danger, colors.dangerSoft),
};

export const ALERT_SEVERITY: Record<AlertSeverity, Tone> = {
  CRITICAL: tone('Critique', colors.danger, colors.dangerSoft),
  WARNING: tone('Attention', colors.warning, colors.warningSoft),
  INFO: tone('Info', colors.info, colors.infoSoft),
};

export const INCIDENT_TYPE: Record<IncidentType, string> = {
  ACCIDENT: 'Accident',
  PANNE: 'Panne',
  PROBLEME_MECANIQUE: 'Problème mécanique',
  PNEU: 'Pneu',
  AUTRE: 'Autre',
};
