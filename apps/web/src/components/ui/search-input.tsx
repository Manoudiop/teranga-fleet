'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDebounced } from '@/lib/use-url-state';
import { Input } from './primitives';

/** Champ de recherche : la valeur n'est transmise qu'après une courte pause de frappe. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  const debounced = useDebounced(text);

  // Valeur changée de l'extérieur (URL, bouton Retour) : resynchronisation pendant le rendu.
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // onChange change à chaque rendu : seule la valeur saisie déclenche la recherche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
