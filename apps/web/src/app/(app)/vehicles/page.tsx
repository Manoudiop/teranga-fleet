'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState, ErrorState, Pagination, Spinner, Toolbar } from '@/components/ui/feedback';
import {
  Card,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
  buttonClass,
} from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/search-input';
import { api } from '@/lib/api';
import { formatKm, fullName } from '@/lib/format';
import { VEHICLE_STATUS, options } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { Vehicle } from '@/lib/types';
import { useUrlState } from '@/lib/use-url-state';

const ALERT_FILTER = [
  { value: 'true', label: 'Avec alerte' },
  { value: 'false', label: 'Sans alerte' },
];

export default function VehiclesPage() {
  const router = useRouter();
  const { values, page, set } = useUrlState(['search', 'status', 'alerts'] as const);
  const query = { ...values, page, limit: 20 };

  const vehicles = useQuery({
    queryKey: [...keys.vehicles, 'list', query],
    queryFn: () => api<PaginatedResponse<Vehicle>>('vehicles', { query }),
    placeholderData: keepPreviousData,
  });

  const filtered = Boolean(values.search || values.status || values.alerts);

  return (
    <>
      <PageHeader
        title="Véhicules"
        description={vehicles.data ? `${vehicles.data.meta.total} véhicule(s)` : undefined}
        actions={
          <Link href="/vehicles/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden />
            Nouveau véhicule
          </Link>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput
            label="Rechercher un véhicule"
            placeholder="Immatriculation, marque, modèle…"
            value={values.search}
            onChange={(search) => set({ search })}
          />
          <Select
            aria-label="Filtrer par statut"
            className="w-full sm:w-48"
            placeholder="Tous les statuts"
            options={options(VEHICLE_STATUS)}
            value={values.status}
            onChange={(e) => set({ status: e.target.value })}
          />
          <Select
            aria-label="Filtrer par alerte"
            className="w-full sm:w-44"
            placeholder="Toutes les alertes"
            options={ALERT_FILTER}
            value={values.alerts}
            onChange={(e) => set({ alerts: e.target.value })}
          />
        </Toolbar>

        {vehicles.isPending ? (
          <Spinner />
        ) : vehicles.isError ? (
          <ErrorState error={vehicles.error} onRetry={() => void vehicles.refetch()} />
        ) : vehicles.data.data.length === 0 ? (
          <EmptyState
            icon={<Truck className="size-6" />}
            title={
              filtered
                ? 'Aucun véhicule ne correspond à ces filtres'
                : 'Aucun véhicule pour le moment'
            }
            description={
              filtered
                ? undefined
                : 'Ajoutez les véhicules de votre flotte pour suivre leurs documents et entretiens.'
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Immatriculation</Th>
                  <Th>Véhicule</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">Kilométrage</Th>
                  <Th>Chauffeur</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.data.data.map((v) => (
                  <tr
                    key={v.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/vehicles/${v.id}`)}
                  >
                    <Td>
                      <Link
                        href={`/vehicles/${v.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {v.immatriculation}
                      </Link>
                    </Td>
                    <Td>
                      <span className="text-slate-900">
                        {v.marque} {v.modele}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {[v.type, v.annee].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge value={VEHICLE_STATUS[v.statut]} />
                    </Td>
                    <Td className="text-right tabular-nums">{formatKm(v.kilometrageActuel)}</Td>
                    <Td>
                      {v.currentDriver ? (
                        fullName(v.currentDriver)
                      ) : (
                        <span className="text-slate-400">Non affecté</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={vehicles.data.meta} onPage={(p) => set({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
