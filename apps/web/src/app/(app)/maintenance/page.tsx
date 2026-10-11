'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { MaintenanceModal } from '@/components/modals/maintenance-modal';
import { EmptyState, ErrorState, Pagination, Spinner, Toolbar } from '@/components/ui/feedback';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/search-input';
import { api } from '@/lib/api';
import { formatDate, formatKm, formatXof } from '@/lib/format';
import { keys, useVehicleOptions } from '@/lib/queries';
import type { MaintenanceDue, MaintenanceRecord } from '@/lib/types';
import { useUrlState } from '@/lib/use-url-state';

function dueLabel(d: MaintenanceDue): string {
  const parts: string[] = [];
  if (d.km) {
    parts.push(
      d.km.remaining <= 0
        ? `dépassé de ${formatKm(-d.km.remaining)} (prévu à ${formatKm(d.km.due)})`
        : `dans ${formatKm(d.km.remaining)}`,
    );
  }
  if (d.date) {
    parts.push(
      d.date.daysRemaining < 0
        ? `prévu le ${formatDate(d.date.due)}`
        : d.date.daysRemaining === 0
          ? "prévu aujourd'hui"
          : `dans ${d.date.daysRemaining} jour(s) (${formatDate(d.date.due)})`,
    );
  }
  return parts.join(' · ');
}

export default function MaintenancePage() {
  const { values, page, set } = useUrlState(['search', 'vehicleId', 'from', 'to'] as const);
  const query = { ...values, page, limit: 20 };
  const [editing, setEditing] = useState<MaintenanceRecord | 'new' | null>(null);
  const vehicles = useVehicleOptions();

  const due = useQuery({
    queryKey: [...keys.maintenance, 'due'],
    queryFn: () => api<MaintenanceDue[]>('maintenance/due'),
  });
  const history = useQuery({
    queryKey: [...keys.maintenance, 'list', query],
    queryFn: () =>
      api<PaginatedResponse<MaintenanceRecord> & { totalCout: number }>('maintenance', { query }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Entretiens à prévoir et historique des interventions."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Enregistrer un entretien
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="À prévoir"
          description="Échéances dépassées ou proches (kilométrage ou date)"
        />
        {due.isPending ? (
          <Spinner />
        ) : due.isError ? (
          <ErrorState error={due.error} onRetry={() => void due.refetch()} />
        ) : due.data.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-6 text-emerald-500" />}
            title="Aucun entretien à prévoir"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {due.data.map((d) => (
              <li key={d.maintenanceId} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <Badge tone={d.level === 'OVERDUE' ? 'danger' : 'warning'}>
                  {d.level === 'OVERDUE' ? 'Dépassé' : 'À prévoir'}
                </Badge>
                <Link
                  href={`/vehicles/${d.vehicle.id}`}
                  className="font-medium text-slate-900 hover:text-brand-700"
                >
                  {d.vehicle.immatriculation}
                </Link>
                <span className="text-slate-700">{d.type}</span>
                <span className="text-sm text-slate-500">{dueLabel(d)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Historique"
          description={
            history.data
              ? `${history.data.meta.total} entretien(s) · ${formatXof(history.data.totalCout)}`
              : undefined
          }
        />
        <Toolbar>
          <SearchInput
            label="Rechercher un entretien"
            placeholder="Intervention, garage, immatriculation…"
            value={values.search}
            onChange={(search) => set({ search })}
          />
          <Select
            aria-label="Filtrer par véhicule"
            className="w-full sm:w-52"
            placeholder="Tous les véhicules"
            options={(vehicles.data ?? []).map((v) => ({ value: v.id, label: v.immatriculation }))}
            value={values.vehicleId}
            onChange={(e) => set({ vehicleId: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Du
            <Input
              type="date"
              className="w-40"
              value={values.from}
              onChange={(e) => set({ from: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            au
            <Input
              type="date"
              className="w-40"
              value={values.to}
              onChange={(e) => set({ to: e.target.value })}
            />
          </label>
        </Toolbar>
        {history.isPending ? (
          <Spinner />
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => void history.refetch()} />
        ) : history.data.data.length === 0 ? (
          <EmptyState icon={<Wrench className="size-6" />} title="Aucun entretien ne correspond" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Véhicule</Th>
                  <Th>Intervention</Th>
                  <Th className="text-right">Kilométrage</Th>
                  <Th className="text-right">Coût</Th>
                  <Th>Garage</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.data.data.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{formatDate(r.date)}</Td>
                    <Td>
                      <Link
                        href={`/vehicles/${r.vehicle.id}`}
                        className="font-medium whitespace-nowrap text-slate-900 hover:text-brand-700"
                      >
                        {r.vehicle.immatriculation}
                      </Link>
                    </Td>
                    <Td className="text-slate-900">{r.type}</Td>
                    <Td className="text-right tabular-nums">{formatKm(r.kilometrageAuMoment)}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">
                      {formatXof(r.cout)}
                    </Td>
                    <Td>{r.garage ?? '—'}</Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(r)}
                        aria-label="Modifier l'entretien"
                        icon={<Pencil className="size-4" />}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={history.data.meta} onPage={(p) => set({ page: p })} />
          </>
        )}
      </Card>

      {editing && (
        <MaintenanceModal
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
