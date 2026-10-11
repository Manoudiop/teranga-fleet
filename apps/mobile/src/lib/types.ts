import type {
  DocumentStatus,
  DriverStatus,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  MileageSource,
  VehicleStatus,
} from '@teranga-fleet/shared';

export interface MyVehicle {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  statut: VehicleStatus;
  kilometrageActuel: number;
}

/** Réponse de GET /drivers/me. */
export interface DriverProfile {
  id: string;
  nom: string;
  prenom: string;
  contact: string | null;
  numeroPermis: string;
  dateExpirationPermis: string;
  statut: DriverStatus;
  permisStatus: DocumentStatus;
  account: { email: string } | null;
  currentAssignment: { id: string; dateDebut: string } | null;
  currentVehicle: MyVehicle | null;
}

export interface MileageLog {
  id: string;
  date: string;
  kilometrage: number;
  source: MileageSource;
  vehicle: { id: string; immatriculation: string; marque: string; modele: string };
}

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  notesGestionnaire: string | null;
  hasPhoto: boolean;
  createdAt: string;
  resolvedAt: string | null;
  vehicle: { id: string; immatriculation: string };
}
