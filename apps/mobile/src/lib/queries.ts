import type { Alert } from '@teranga-fleet/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { DriverProfile } from './types';

export const keys = {
  profile: ['profile'] as const,
  alerts: ['alerts'] as const,
  mileage: ['mileage'] as const,
  incidents: ['incidents'] as const,
};

/** Profil du chauffeur et véhicule affecté. */
export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => api<DriverProfile>('drivers/me') });
}

/** Alertes de son véhicule et de son permis. */
export function useAlerts() {
  return useQuery({ queryKey: keys.alerts, queryFn: () => api<Alert[]>('alerts') });
}
