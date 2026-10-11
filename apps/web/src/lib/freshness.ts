import { formatDateTime } from './format';

/** Fraîcheur d'une position : la couleur n'est jamais le seul repère (âge écrit à côté). */
export function freshness(recordedAt: string, now = Date.now()) {
  const minutes = (now - new Date(recordedAt).getTime()) / 60_000;
  if (minutes <= 15) return { color: '#0f7a69', label: 'Position récente' };
  if (minutes <= 120) return { color: '#d97706', label: 'Position de moins de 2 h' };
  return { color: '#94a3b8', label: 'Position ancienne' };
}

/** « à l'instant », « il y a 12 min », « il y a 3 h », puis la date. */
export function ago(recordedAt: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(recordedAt).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `il y a ${hours} h` : formatDateTime(recordedAt);
}
