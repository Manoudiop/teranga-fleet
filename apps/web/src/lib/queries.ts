'use client';

import type { Alert, AuthUserResponse } from '@teranga-fleet/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Clés TanStack Query : invalider une racine rafraîchit toutes les vues qui en dépendent. */
export const keys = {
  me: ['me'] as const,
  vehicles: ['vehicles'] as const,
  drivers: ['drivers'] as const,
  documents: ['documents'] as const,
  maintenance: ['maintenance'] as const,
  assignments: ['assignments'] as const,
  mileage: ['mileage'] as const,
  incidents: ['incidents'] as const,
  alerts: ['alerts'] as const,
  dashboard: ['dashboard'] as const,
  locations: ['locations'] as const,
};

/**
 * Données dérivées de presque toute modification (alertes, dashboard,
 * compteurs) : à invalider après chaque écriture.
 */
export const DERIVED = [keys.alerts, keys.dashboard];

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<AuthUserResponse>('auth/me'),
    staleTime: 5 * 60_000,
  });
}

export function useAlerts() {
  return useQuery({ queryKey: keys.alerts, queryFn: () => api<Alert[]>('alerts') });
}
