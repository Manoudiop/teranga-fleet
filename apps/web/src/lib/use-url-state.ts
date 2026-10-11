'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * Filtres d'une liste conservés dans l'URL (?status=ACTIVE&page=2) : la page
 * filtrée se partage, se recharge et revient intacte avec le bouton Retour.
 */
export function useUrlState<K extends string>(names: readonly K[]) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const values = Object.fromEntries(names.map((n) => [n, params.get(n) ?? ''])) as Record<
    K,
    string
  >;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const set = useCallback(
    (changes: Partial<Record<K | 'page', string | number | undefined>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '' || value === null) next.delete(key);
        else next.set(key, String(value));
      }
      // Un changement de filtre ramène à la première page.
      if (!('page' in changes)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { values, page, set };
}

/** Valeur retardée (recherche au fil de la frappe sans requête à chaque touche). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
