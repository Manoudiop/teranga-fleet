'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fullName } from '@/lib/format';
import { keys } from '@/lib/queries';
import type { Driver, Vehicle } from '@/lib/types';
import { Combobox, type ComboboxOption } from './ui/combobox';

/** Résultats affichés par recherche : au-delà, l'utilisateur précise sa saisie. */
const PAGE = 20;

interface PickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Option « Tous… » des filtres de liste. */
  clearLabel?: string;
  /** Seulement les éléments affectables (ni hors service / inactifs, ni déjà affectés). */
  available?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}

const vehicleOption = (v: Vehicle): ComboboxOption => ({
  value: v.id,
  label: v.immatriculation,
  hint: `${v.marque} ${v.modele}`,
});

const driverOption = (d: Driver): ComboboxOption => ({
  value: d.id,
  label: fullName(d),
  hint: d.contact ?? d.numeroPermis,
});

/**
 * Libellé de la valeur courante : celui de l'option choisie, sinon (valeur venue de l'URL
 * ou imposée par la page) chargé depuis la fiche.
 */
function useSelectedLabel<T>(
  value: string,
  detailKey: readonly unknown[],
  path: string,
  toOption: (item: T) => ComboboxOption,
) {
  const [picked, setPicked] = useState<ComboboxOption | null>(null);
  const known = picked?.value === value ? picked : null;
  const detail = useQuery({
    queryKey: [...detailKey, 'detail', value],
    queryFn: () => api<T>(`${path}/${value}`),
    enabled: Boolean(value) && !known,
    staleTime: 60_000,
  });
  const label = known?.label ?? (value && detail.data ? toOption(detail.data).label : null) ?? null;
  return { label, setPicked };
}

export function VehiclePicker({ value, onChange, available, ...props }: PickerProps) {
  const { label, setPicked } = useSelectedLabel(value, keys.vehicles, 'vehicles', vehicleOption);
  return (
    <Combobox
      {...props}
      value={value}
      selectedLabel={label}
      onChange={(next, option) => {
        setPicked(option);
        onChange(next);
      }}
      queryKey={[...keys.vehicles, 'picker', { available: Boolean(available) }]}
      search={async (search) => {
        const res = await api<PaginatedResponse<Vehicle>>('vehicles', {
          query: { search, limit: PAGE, available: available || undefined },
        });
        return { options: res.data.map(vehicleOption), total: res.meta.total };
      }}
    />
  );
}

export function DriverPicker({ value, onChange, available, ...props }: PickerProps) {
  const { label, setPicked } = useSelectedLabel(value, keys.drivers, 'drivers', driverOption);
  return (
    <Combobox
      {...props}
      value={value}
      selectedLabel={label}
      onChange={(next, option) => {
        setPicked(option);
        onChange(next);
      }}
      queryKey={[...keys.drivers, 'picker', { available: Boolean(available) }]}
      search={async (search) => {
        const res = await api<PaginatedResponse<Driver>>('drivers', {
          query: { search, limit: PAGE, available: available || undefined },
        });
        return { options: res.data.map(driverOption), total: res.meta.total };
      }}
    />
  );
}
