'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Siren, Truck, Users } from 'lucide-react';
import { EmptyState, ErrorState, Pagination, Spinner, Toolbar } from '@/components/ui/feedback';
import { Card, PageHeader, Table, Td, Th } from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/search-input';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { useUrlState } from '@/lib/use-url-state';

interface AdminStats {
  companies: { total: number; createdLast30Days: number };
  users: { total: number; byRole: Record<string, number> };
  vehicles: number;
  drivers: number;
  openIncidents: number;
}

interface CompanyRow {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  createdAt: string;
  _count: { users: number; vehicles: number; drivers: number; incidents: number };
}

/** Administration de la plateforme (rôle ADMIN) : entreprises clientes et volumes. */
export default function AdminPage() {
  const { values, page, set } = useUrlState(['search'] as const);
  const query = { ...values, page, limit: 20 };

  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api<AdminStats>('admin/stats'),
  });
  const companies = useQuery({
    queryKey: ['admin', 'companies', query],
    queryFn: () => api<PaginatedResponse<CompanyRow>>('admin/companies', { query }),
    placeholderData: keepPreviousData,
  });

  const tiles = stats.data && [
    {
      label: 'Entreprises',
      value: stats.data.companies.total,
      detail: `+${stats.data.companies.createdLast30Days} sur 30 jours`,
      icon: Building2,
    },
    {
      label: 'Véhicules suivis',
      value: stats.data.vehicles,
      detail: `${stats.data.drivers} chauffeurs`,
      icon: Truck,
    },
    {
      label: 'Comptes utilisateurs',
      value: stats.data.users.total,
      detail: `${stats.data.users.byRole.GESTIONNAIRE ?? 0} gestionnaires, ${stats.data.users.byRole.CHAUFFEUR ?? 0} chauffeurs`,
      icon: Users,
    },
    {
      label: 'Incidents ouverts',
      value: stats.data.openIncidents,
      detail: 'toutes entreprises',
      icon: Siren,
    },
  ];

  return (
    <>
      <PageHeader
        title="Administration de la plateforme"
        description="Entreprises clientes et volumes d'utilisation."
      />
      {stats.isError && (
        <Card className="mb-6">
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        </Card>
      )}
      {tiles && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">{t.label}</p>
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <t.icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">
                {formatNumber(t.value)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{t.detail}</p>
            </div>
          ))}
        </div>
      )}

      <Card>
        <Toolbar>
          <SearchInput
            label="Rechercher une entreprise"
            placeholder="Nom ou email…"
            value={values.search}
            onChange={(search) => set({ search })}
          />
        </Toolbar>
        {companies.isPending ? (
          <Spinner />
        ) : companies.isError ? (
          <ErrorState error={companies.error} onRetry={() => void companies.refetch()} />
        ) : companies.data.data.length === 0 ? (
          <EmptyState icon={<Building2 className="size-6" />} title="Aucune entreprise" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Entreprise</Th>
                  <Th>Inscrite le</Th>
                  <Th className="text-right">Véhicules</Th>
                  <Th className="text-right">Chauffeurs</Th>
                  <Th className="text-right">Comptes</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.data.data.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <span className="font-medium text-slate-900">{c.nom}</span>
                      <span className="block text-xs text-slate-500">
                        {c.email}
                        {c.telephone && ` · ${c.telephone}`}
                      </span>
                    </Td>
                    <Td>{formatDate(c.createdAt)}</Td>
                    <Td className="text-right tabular-nums">{c._count.vehicles}</Td>
                    <Td className="text-right tabular-nums">{c._count.drivers}</Td>
                    <Td className="text-right tabular-nums">{c._count.users}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={companies.data.meta} onPage={(p) => set({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
