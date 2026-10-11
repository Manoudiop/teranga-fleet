const dateFormat = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Africa/Dakar',
});
const numberFormat = new Intl.NumberFormat('fr-FR');
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

/** Date calendaire (stockée à minuit UTC) : 23/10/2026. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateFormat.format(new Date(value));
}

/** Date et heure à Dakar : 11/10/2026 18:30. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateTimeFormat.format(new Date(value));
}

export function formatKm(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${numberFormat.format(value)} km`;
}

/** Montant en francs CFA : 120 000 F CFA. */
export function formatXof(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${numberFormat.format(value)} F CFA`;
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** « 2026-10 » → « oct. ». */
export function formatMonth(month: string): string {
  return monthFormat.format(new Date(`${month}-01T00:00:00Z`));
}

/** Date du jour au format AAAA-MM-JJ (valeur d'un champ date). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Valeur d'un champ date à partir d'une date ISO renvoyée par l'API. */
export function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

export function fullName(person: { prenom: string; nom: string } | null | undefined): string {
  return person ? `${person.prenom} ${person.nom}` : '—';
}
