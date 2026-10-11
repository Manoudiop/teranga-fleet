'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DERIVED } from './queries';

/**
 * Après une écriture : rafraîchit les données concernées ainsi que les données
 * dérivées (alertes, tableau de bord), qui dépendent de presque tout.
 */
export function useInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(
    (...roots: QueryKey[]) =>
      Promise.all(
        [...roots, ...DERIVED].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
    [queryClient],
  );
}
