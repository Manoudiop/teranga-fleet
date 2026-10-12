'use client';

import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { Check, ChevronDown, LoaderCircle, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { useDebounced } from '@/lib/use-url-state';
import { cn } from './primitives';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Précision affichée sous le libellé (marque, contact…). */
  hint?: string;
}

export interface ComboboxResult {
  options: ComboboxOption[];
  /** Nombre total de correspondances côté serveur (peut dépasser les options reçues). */
  total: number;
}

/**
 * Liste déroulante avec recherche côté serveur : convient aux listes trop longues pour
 * un <select> (une flotte de plusieurs centaines de véhicules).
 */
export function Combobox({
  id,
  value,
  onChange,
  selectedLabel,
  search,
  queryKey,
  placeholder,
  clearLabel,
  disabled,
  invalid,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string, option: ComboboxOption | null) => void;
  /** Libellé de la valeur actuelle (null : inconnu ou en cours de chargement). */
  selectedLabel: string | null;
  search: (term: string) => Promise<ComboboxResult>;
  /** Préfixe du cache des résultats ; le terme recherché y est ajouté. */
  queryKey: QueryKey;
  placeholder: string;
  /** Si fourni, une option en tête de liste vide la sélection (filtres « Tous… »). */
  clearLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const listId = useId();
  // null : champ fermé, qui affiche la sélection ; sinon le texte saisi.
  const [term, setTerm] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const open = term !== null;
  const debounced = useDebounced(term?.trim() ?? '', 250);

  const results = useQuery({
    queryKey: [...queryKey, 'search', debounced],
    queryFn: () => search(debounced),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const clearOption: ComboboxOption | null =
    clearLabel && !term ? { value: '', label: clearLabel } : null;
  const options = [...(clearOption ? [clearOption] : []), ...(results.data?.options ?? [])];
  const hidden = (results.data?.total ?? 0) - (results.data?.options.length ?? 0);

  function close() {
    setTerm(null);
    setActive(0);
  }

  function pick(option: ComboboxOption) {
    onChange(option.value, option.value ? option : null);
    close();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setTerm('');
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (options.length ? (i + step + options.length) % options.length : 0));
    } else if (e.key === 'Enter' && open) {
      // Dans un formulaire, Entrée choisit l'option au lieu de soumettre.
      e.preventDefault();
      const option = options[active];
      if (option) pick(option);
    } else if (e.key === 'Escape' && open) {
      // Ferme la liste sans fermer la fenêtre modale qui la contient.
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        value={term ?? selectedLabel ?? ''}
        placeholder={open ? (selectedLabel ?? placeholder) : value ? 'Chargement…' : placeholder}
        onChange={(e) => {
          setTerm(e.target.value);
          setActive(0);
        }}
        // Pas d'ouverture au simple focus (les modales le placent sur le premier champ) ; le
        // libellé affiché est sélectionné pour que la frappe le remplace.
        onFocus={(e) => e.target.select()}
        onClick={() => !open && setTerm('')}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={cn(
          'block h-10 w-full truncate rounded-lg border-0 bg-white pr-14 pl-3 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset',
          'placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 focus:ring-inset disabled:bg-slate-50 disabled:text-slate-500',
          invalid && 'ring-red-400',
          !open && !value && 'placeholder:text-slate-500',
        )}
      />
      <span className="absolute inset-y-0 right-2 flex items-center gap-1 text-slate-400">
        {open && results.isFetching && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {clearLabel && value && !open && !disabled && (
          <button
            type="button"
            className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => onChange('', null)}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <X className="size-4" />
          </button>
        )}
        <ChevronDown className="pointer-events-none size-4" aria-hidden />
      </span>

      {open && (
        <div
          className="absolute z-20 mt-1 w-full min-w-56 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200"
          // Garde le focus dans le champ pendant le clic sur une option.
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {options.map((option, i) => (
              <li
                key={option.value || '__clear'}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={option.value === value}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                  i === active ? 'bg-brand-50 text-brand-900' : 'text-slate-700',
                  !option.value && 'text-slate-500',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-xs text-slate-500">{option.hint}</span>
                  )}
                </span>
                {option.value === value && (
                  <Check className="size-4 shrink-0 text-brand-600" aria-hidden />
                )}
              </li>
            ))}
          </ul>
          {results.isError ? (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-red-600">
              Recherche impossible. Réessayez.
            </p>
          ) : results.data && results.data.total === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Aucun résultat</p>
          ) : hidden > 0 ? (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              {hidden} autre{hidden > 1 ? 's' : ''} résultat{hidden > 1 ? 's' : ''} : précisez la
              recherche.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
