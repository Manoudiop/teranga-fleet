const numberFormat = new Intl.NumberFormat('fr-FR');
const dateFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatKm(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${numberFormat.format(value)} km`;
}

/** Date calendaire (stockée à minuit UTC). */
export function formatDate(value: string | Date | null | undefined): string {
  return value ? dateFormat.format(new Date(value)) : '—';
}

/** Date et heure dans le fuseau du téléphone. */
export function formatDateTime(value: string | Date | null | undefined): string {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

/** « il y a 5 min », « il y a 2 h »… pour l'état de la localisation. */
export function timeAgo(value: Date | string | null | undefined, now = new Date()): string {
  if (!value) return 'jamais';
  const minutes = Math.round((now.getTime() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `il y a ${hours} h` : formatDateTime(value);
}
