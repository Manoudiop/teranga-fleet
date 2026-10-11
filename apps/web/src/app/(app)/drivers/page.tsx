'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Smartphone, Users } from 'lucide-react';
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
import { formatDate } from '@/lib/format';
import { DRIVER_STATUS, EXPIRY_STATUS, options } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { Driver } from '@/lib/types';
import { useUrlState } from '@/lib/use-url-state';

const PERMIS_FILTER = [
  { value: 'EXPIRE', label: 'Permis expiré' },
  { value: 'EXPIRANT_BIENTOT', label: 'Expire bientôt' },
  { value: 'VALIDE', label: 'Permis valide' },
];

export default function DriversPage() {
  const router = useRouter();
  const { values, page, set } = useUrlState(['search', 'statut', 'permis'] as const);
  const query = { ...values, page, limit: 20 };

  const drivers = useQuery({
    queryKey: [...keys.drivers, 'list', query],
    queryFn: () => api<PaginatedResponse<Driver>>('drivers', { query }),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(values.search || values.statut || values.permis);

  return (
    <>
      <PageHeader
        title="Chauffeurs"
        description={drivers.data ? `${drivers.data.meta.total} chauffeur(s)` : undefined}
        actions={
          <Link href="/drivers/new" className={buttonClass()}>
            <Plus className="size-4" aria-hidden />
            Nouveau chauffeur
          </Link>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput
            label="Rechercher un chauffeur"
            placeholder="Nom, téléphone, n° de permis…"
            value={values.search}
            onChange={(search) => set({ search })}
          />
          <Select
            aria-label="Filtrer par statut"
            className="w-full sm:w-44"
            placeholder="Tous les statuts"
            options={options(DRIVER_STATUS)}
            value={values.statut}
            onChange={(e) => set({ statut: e.target.value })}
          />
          <Select
            aria-label="Filtrer par permis"
            className="w-full sm:w-48"
            placeholder="Tous les permis"
            options={PERMIS_FILTER}
            value={values.permis}
            onChange={(e) => set({ permis: e.target.value })}
          />
        </Toolbar>

        {drivers.isPending ? (
          <Spinner />
        ) : drivers.isError ? (
          <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />
        ) : drivers.data.data.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title={
              filtered
                ? 'Aucun chauffeur ne correspond à ces filtres'
                : 'Aucun chauffeur pour le moment'
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Chauffeur</Th>
                  <Th>Permis</Th>
                  <Th>Statut</Th>
                  <Th>Véhicule actuel</Th>
                  <Th>Application</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.data.data.map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/drivers/${d.id}`)}
                  >
                    <Td>
                      <Link
                        href={`/drivers/${d.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.prenom} {d.nom}
                      </Link>
                      <span className="block text-xs text-slate-500">{d.contact ?? '—'}</span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-900">{formatDate(d.dateExpirationPermis)}</span>
                        {d.permisStatus !== 'VALIDE' && (
                          <StatusBadge value={EXPIRY_STATUS[d.permisStatus]} />
                        )}
                      </span>
                      <span className="block text-xs text-slate-500">{d.numeroPermis}</span>
                    </Td>
                    <Td>
                      <StatusBadge value={DRIVER_STATUS[d.statut]} />
                    </Td>
                    <Td>
                      {d.currentVehicle ? (
                        <span className="font-medium text-slate-900">
                          {d.currentVehicle.immatriculation}
                        </span>
                      ) : (
                        <span className="text-slate-400">Aucun</span>
                      )}
                    </Td>
                    <Td>
                      {d.account ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Smartphone className="size-4 text-brand-600" aria-hidden /> Activée
                        </span>
                      ) : (
                        <span className="text-slate-400">Sans accès</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={drivers.data.meta} onPage={(p) => set({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
