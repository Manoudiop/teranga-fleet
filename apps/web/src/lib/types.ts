/**
 * Formes des réponses de l'API utilisées par le dashboard. Les énumérations et
 * les contrats transverses (erreurs, pagination, alertes, auth) viennent de
 * @teranga-fleet/shared.
 */
import type {
  DocumentStatus,
  DocumentType,
  DriverStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MileageSource,
  VehicleStatus,
} from '@teranga-fleet/shared';

export interface PersonRef {
  id: string;
  nom: string;
  prenom: string;
  contact?: string | null;
}

export interface VehicleRef {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
}

export interface Vehicle extends VehicleRef {
  annee: number | null;
  type: string | null;
  dateAcquisition: string | null;
  statut: VehicleStatus;
  kilometrageActuel: number;
  createdAt: string;
  currentAssignment: { id: string; dateDebut: string } | null;
  currentDriver: PersonRef | null;
}

export interface VehicleDetail extends Vehicle {
  counts: {
    documents: number;
    maintenanceRecords: number;
    mileageLogs: number;
    openIncidents: number;
  };
}

export interface Driver extends PersonRef {
  numeroPermis: string;
  dateExpirationPermis: string;
  statut: DriverStatus;
  permisStatus: DocumentStatus;
  account: { email: string } | null;
  currentAssignment: { id: string; dateDebut: string } | null;
  currentVehicle: (VehicleRef & { statut: VehicleStatus; kilometrageActuel: number }) | null;
}

export interface DriverDetail extends Driver {
  assignments: { id: string; dateDebut: string; dateFin: string | null; vehicle: VehicleRef }[];
}

export interface FleetDocument {
  id: string;
  vehicleId: string;
  type: DocumentType;
  dateEmission: string | null;
  dateExpiration: string;
  status: DocumentStatus;
  hasFile: boolean;
  fileType: string | null;
  vehicle?: VehicleRef;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  type: string;
  date: string;
  kilometrageAuMoment: number;
  cout: number;
  garage: string | null;
  notes: string | null;
  prochainEntretienKm: number | null;
  prochainEntretienDate: string | null;
  vehicle: VehicleRef & { kilometrageActuel: number };
}

export interface MaintenanceDue {
  maintenanceId: string;
  vehicleId: string;
  type: string;
  level: 'OVERDUE' | 'SOON';
  km: { due: number; current: number; remaining: number } | null;
  date: { due: string; daysRemaining: number } | null;
  vehicle: VehicleRef & { kilometrageActuel: number };
}

export interface Assignment {
  id: string;
  dateDebut: string;
  dateFin: string | null;
  active: boolean;
  vehicle: VehicleRef & { statut: VehicleStatus };
  driver: PersonRef;
}

export interface MileageLog {
  id: string;
  date: string;
  kilometrage: number;
  source: MileageSource;
  driver: PersonRef | null;
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  notesGestionnaire: string | null;
  hasPhoto: boolean;
  resolvedAt: string | null;
  createdAt: string;
  vehicle: VehicleRef;
  driver: PersonRef | null;
}

export interface DashboardSummary {
  vehicles: { total: number; active: number; maintenance: number; horsService: number };
  drivers: { total: number; active: number };
  documents: { expired: number; expiringSoon: number };
  licenses: { expired: number; expiringSoon: number };
  maintenance: { overdue: number; dueSoon: number; costThisMonth: number };
  incidents: { open: number };
  alerts: { critical: number; warning: number; total: number };
}

export interface MaintenanceCosts {
  months: { month: string; total: number; count: number }[];
  total: number;
}

export interface LatestLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  /** Vitesse en m/s. */
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  vehicle: VehicleRef & { statut: VehicleStatus };
  driver: PersonRef | null;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  recordedAt: string;
}

export interface Track {
  from: string;
  to: string;
  truncated: boolean;
  points: TrackPoint[];
}
