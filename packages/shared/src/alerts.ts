export const AlertType = {
  DOCUMENT_EXPIRED: 'DOCUMENT_EXPIRED',
  DOCUMENT_EXPIRING: 'DOCUMENT_EXPIRING',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  LICENSE_EXPIRING: 'LICENSE_EXPIRING',
  MAINTENANCE_OVERDUE: 'MAINTENANCE_OVERDUE',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  VEHICLE_OUT_OF_SERVICE: 'VEHICLE_OUT_OF_SERVICE',
  VEHICLE_IN_MAINTENANCE: 'VEHICLE_IN_MAINTENANCE',
  INCIDENT_OPEN: 'INCIDENT_OPEN',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

/** Ordre de priorité : CRITICAL avant WARNING avant INFO. */
export const AlertSeverity = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export interface Alert {
  /** Identifiant stable (type + ressource), utilisable comme clé d'affichage. */
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  vehicleId: string | null;
  driverId: string | null;
  documentId: string | null;
  maintenanceId: string | null;
  incidentId: string | null;
  /** Date de référence : échéance, date de déclaration... */
  date: string | null;
}
