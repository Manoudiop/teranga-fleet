import { daysUntil, type Alert, type AlertSeverity } from '@teranga-fleet/shared';
import type { DocumentType, IncidentSeverity, VehicleStatus } from '../generated/prisma/enums';
import type { MaintenanceDue } from '../maintenance/maintenance-due';

interface VehicleRef {
  id: string;
  immatriculation: string;
  statut: VehicleStatus;
}

export interface AlertsInput {
  vehicles: VehicleRef[];
  documents: { id: string; vehicleId: string; type: DocumentType; dateExpiration: Date }[];
  drivers: { id: string; nom: string; prenom: string; dateExpirationPermis: Date }[];
  maintenanceDue: MaintenanceDue[];
  incidents: {
    id: string;
    vehicleId: string;
    driverId: string | null;
    severity: IncidentSeverity;
    description: string;
    createdAt: Date;
  }[];
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  CARTE_GRISE: 'Carte grise',
  ASSURANCE: 'Assurance',
  VISITE_TECHNIQUE: 'Visite technique',
  VIGNETTE: 'Vignette',
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

const formatDate = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');

function inDays(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

function base(
  partial: Partial<Alert> & Pick<Alert, 'id' | 'type' | 'severity' | 'title' | 'message'>,
): Alert {
  return {
    vehicleId: null,
    driverId: null,
    documentId: null,
    maintenanceId: null,
    incidentId: null,
    date: null,
    ...partial,
  };
}

/**
 * Construit les alertes de la flotte, triées par priorité (CRITICAL, WARNING,
 * INFO) puis par date. Pour les documents, seul le plus récent de chaque type
 * par véhicule compte : une assurance renouvelée n'alerte plus sur l'ancienne.
 */
export function buildAlerts(
  input: AlertsInput,
  { today, thresholdDays }: { today: Date; thresholdDays: number },
): Alert[] {
  const vehicles = new Map(input.vehicles.map((v) => [v.id, v]));
  const plate = (vehicleId: string) => vehicles.get(vehicleId)?.immatriculation ?? 'véhicule';
  const alerts: Alert[] = [];

  // Documents : le plus récent (expiration la plus lointaine) par véhicule et par type.
  const latestDocuments = new Map<string, AlertsInput['documents'][number]>();
  for (const doc of input.documents) {
    const key = `${doc.vehicleId}|${doc.type}`;
    const current = latestDocuments.get(key);
    if (!current || doc.dateExpiration > current.dateExpiration) latestDocuments.set(key, doc);
  }
  for (const doc of latestDocuments.values()) {
    const days = daysUntil(doc.dateExpiration, today);
    if (days > thresholdDays) continue;
    const label = DOCUMENT_LABELS[doc.type];
    const expired = days < 0;
    alerts.push(
      base({
        id: `document:${doc.id}`,
        type: expired ? 'DOCUMENT_EXPIRED' : 'DOCUMENT_EXPIRING',
        severity: expired ? 'CRITICAL' : 'WARNING',
        title: expired ? `${label} expirée` : `${label} bientôt expirée`,
        message: expired
          ? `${label} du véhicule ${plate(doc.vehicleId)} expirée depuis le ${formatDate(doc.dateExpiration)}`
          : `${label} du véhicule ${plate(doc.vehicleId)} expire ${inDays(days)} (${formatDate(doc.dateExpiration)})`,
        vehicleId: doc.vehicleId,
        documentId: doc.id,
        date: doc.dateExpiration.toISOString(),
      }),
    );
  }

  for (const driver of input.drivers) {
    const days = daysUntil(driver.dateExpirationPermis, today);
    if (days > thresholdDays) continue;
    const name = `${driver.prenom} ${driver.nom}`;
    const expired = days < 0;
    alerts.push(
      base({
        id: `license:${driver.id}`,
        type: expired ? 'LICENSE_EXPIRED' : 'LICENSE_EXPIRING',
        severity: expired ? 'CRITICAL' : 'WARNING',
        title: expired ? 'Permis expiré' : 'Permis bientôt expiré',
        message: expired
          ? `Le permis de ${name} est expiré depuis le ${formatDate(driver.dateExpirationPermis)}`
          : `Le permis de ${name} expire ${inDays(days)} (${formatDate(driver.dateExpirationPermis)})`,
        driverId: driver.id,
        date: driver.dateExpirationPermis.toISOString(),
      }),
    );
  }

  for (const due of input.maintenanceDue) {
    const overdue = due.level === 'OVERDUE';
    const reasons: string[] = [];
    if (due.km) {
      reasons.push(
        due.km.remaining <= 0
          ? `dépassé de ${Math.abs(due.km.remaining).toLocaleString('fr-FR')} km`
          : `dans ${due.km.remaining.toLocaleString('fr-FR')} km`,
      );
    }
    if (due.date) {
      reasons.push(
        due.date.daysRemaining < 0
          ? `prévu le ${formatDate(due.date.due)}`
          : `prévu ${inDays(due.date.daysRemaining)}`,
      );
    }
    alerts.push(
      base({
        id: `maintenance:${due.maintenanceId}`,
        type: overdue ? 'MAINTENANCE_OVERDUE' : 'MAINTENANCE_DUE',
        severity: overdue ? 'CRITICAL' : 'WARNING',
        title: overdue ? 'Entretien dépassé' : 'Entretien à prévoir',
        message: `${due.type} du véhicule ${plate(due.vehicleId)} : ${reasons.join(', ')}`,
        vehicleId: due.vehicleId,
        maintenanceId: due.maintenanceId,
        date: due.date?.due.toISOString() ?? null,
      }),
    );
  }

  for (const incident of input.incidents) {
    if (incident.severity !== 'CRITICAL' && incident.severity !== 'HIGH') continue;
    const critical = incident.severity === 'CRITICAL';
    alerts.push(
      base({
        id: `incident:${incident.id}`,
        type: 'INCIDENT_OPEN',
        severity: critical ? 'CRITICAL' : 'WARNING',
        title: critical ? 'Incident critique en cours' : 'Incident grave en cours',
        message: `${plate(incident.vehicleId)} : ${incident.description.slice(0, 120)}`,
        vehicleId: incident.vehicleId,
        driverId: incident.driverId,
        incidentId: incident.id,
        date: incident.createdAt.toISOString(),
      }),
    );
  }

  for (const vehicle of input.vehicles) {
    if (vehicle.statut === 'ACTIVE') continue;
    const outOfService = vehicle.statut === 'HORS_SERVICE';
    alerts.push(
      base({
        id: `vehicle:${vehicle.id}`,
        type: outOfService ? 'VEHICLE_OUT_OF_SERVICE' : 'VEHICLE_IN_MAINTENANCE',
        severity: outOfService ? 'WARNING' : 'INFO',
        title: outOfService ? 'Véhicule hors service' : 'Véhicule en maintenance',
        message: `Le véhicule ${vehicle.immatriculation} est ${outOfService ? 'hors service' : 'en maintenance'}`,
        vehicleId: vehicle.id,
      }),
    );
  }

  // Priorité, puis échéance la plus proche (les alertes sans date en dernier).
  return alerts.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.date ?? '9999').localeCompare(b.date ?? '9999'),
  );
}
