import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '../api';
import { readToken } from '../session';

export interface QueuedPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  recordedAt: string;
}

const QUEUE_KEY = 'tf.tracking.queue';
const LAST_SENT_KEY = 'tf.tracking.lastSent';
/** Au-delà, les points les plus anciens sont abandonnés (plusieurs jours hors réseau). */
const MAX_QUEUE = 2_000;
const BATCH_SIZE = 200;

/** Réponse de l'API quand l'affectation est terminée : le suivi doit s'arrêter. */
export class AssignmentEndedError extends Error {}

let flushing: Promise<void> | null = null;

async function readQueue(): Promise<QueuedPoint[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? '[]') as QueuedPoint[];
  } catch {
    return [];
  }
}

function writeQueue(points: QueuedPoint[]) {
  return AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(points.slice(-MAX_QUEUE)));
}

export async function enqueue(points: QueuedPoint[]) {
  if (!points.length) return;
  await writeQueue([...(await readQueue()), ...points]);
}

export async function queuedCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function lastSentAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SENT_KEY);
}

export async function clearQueue() {
  await AsyncStorage.multiRemove([QUEUE_KEY, LAST_SENT_KEY]);
}

/**
 * Envoie la file par lots. Hors réseau, les points restent en file pour le
 * prochain essai. Un lot refusé pour validation est abandonné (il ne passera
 * jamais). Une affectation terminée lève AssignmentEndedError.
 */
export function flush(): Promise<void> {
  flushing ??= doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush() {
  const token = await readToken();
  if (!token) return;

  for (;;) {
    const queue = await readQueue();
    if (!queue.length) return;
    const batch = queue.slice(0, BATCH_SIZE);
    try {
      await api('locations', { method: 'POST', body: { points: batch }, token });
      await AsyncStorage.setItem(LAST_SENT_KEY, new Date().toISOString());
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === 'NO_ACTIVE_ASSIGNMENT') {
        await clearQueue();
        throw new AssignmentEndedError(error.message);
      }
      // Réseau, serveur indisponible ou session expirée : on réessaiera plus tard.
      if (error.status === 0 || error.status === 401 || error.status >= 500) return;
      // Autre refus (validation) : lot abandonné pour ne pas bloquer la file.
    }
    // Retire le lot traité ; des points ont pu être ajoutés entre-temps.
    await writeQueue((await readQueue()).slice(batch.length));
  }
}
