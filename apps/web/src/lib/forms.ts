import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Reporte les erreurs de validation de l'API sous les champs du formulaire.
 * `fields` liste les champs du formulaire portant le même nom que dans l'API,
 * ou fait correspondre un champ de l'API (ex. « entreprise.nom ») à un champ du
 * formulaire. Renvoie true si au moins un champ a été annoté.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[] | Record<string, Path<T>>,
): boolean {
  if (!(error instanceof ApiError) || !error.details) return false;
  const mapping: Record<string, Path<T>> = Array.isArray(fields)
    ? Object.fromEntries(fields.map((f) => [f, f]))
    : (fields as Record<string, Path<T>>);

  let applied = false;
  for (const [apiField, messages] of Object.entries(error.details)) {
    const field = mapping[apiField];
    if (field) {
      setError(field, { message: messages[0] });
      applied = true;
    }
  }
  return applied;
}

/** Champ texte optionnel : chaîne vide → undefined (non envoyé à l'API). */
export function optional(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
