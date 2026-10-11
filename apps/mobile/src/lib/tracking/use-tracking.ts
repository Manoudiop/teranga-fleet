import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { lastSentAt, queuedCount } from './queue';
import {
  backgroundSupported,
  currentMode,
  giveConsent,
  hasConsented,
  startTracking,
  stopTracking,
  withdrawConsent,
} from './tracking';

const TRACKING_KEY = ['tracking'] as const;

async function readTrackingState() {
  const [consented, mode, queued, lastSent] = await Promise.all([
    hasConsented(),
    currentMode(),
    queuedCount(),
    lastSentAt(),
  ]);
  return { consented, mode, queued, lastSent };
}

/** État du service « En service » pour l'interface (consentement, mode, file d'envoi). */
export function useTracking() {
  const queryClient = useQueryClient();
  const state = useQuery({
    queryKey: TRACKING_KEY,
    queryFn: readTrackingState,
    staleTime: 0,
    // La tâche d'arrière-plan vide la file sans prévenir l'interface.
    refetchInterval: 30_000,
  });

  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: TRACKING_KEY }),
  });

  /** Exécute l'action ; renvoie false (message dans `error`) si elle échoue. */
  const perform = useCallback(
    (run: () => Promise<unknown>) =>
      action
        .mutateAsync(run)
        .then(() => true)
        .catch(() => false),
    [action],
  );

  return {
    loading: state.isPending,
    consented: state.data?.consented ?? false,
    mode: state.data?.mode ?? null,
    queued: state.data?.queued ?? 0,
    lastSent: state.data?.lastSent ?? null,
    busy: action.isPending,
    error: action.error instanceof Error ? action.error.message : null,
    backgroundSupported,
    start: () => perform(startTracking),
    stop: () => perform(stopTracking),
    accept: () =>
      perform(async () => {
        await giveConsent();
        await startTracking();
      }),
    withdraw: () => perform(withdrawConsent),
    refresh: useCallback(
      () => queryClient.invalidateQueries({ queryKey: TRACKING_KEY }),
      [queryClient],
    ),
  };
}
