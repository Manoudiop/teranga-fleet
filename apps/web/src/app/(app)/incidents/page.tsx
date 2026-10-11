'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Camera, Plus, Siren } from 'lucide-react';
import { useState } from 'react';
import { IncidentModal, NewIncidentModal } from '@/components/modals/incident-modals';
import { EmptyState, ErrorState, Pagination, Spinner, Toolbar } from '@/components/ui/feedback';
import {
  Button,
  Card,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatDateTime, fullName } from '@/lib/format';
import { INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, options } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { Incident } from '@/lib/types';
import { useUrlState } from '@/lib/use-url-state';

export default function IncidentsPage() {
  const { values, page, set } = useUrlState(['status', 'severity', 'type', 'focus'] as const);
  const { focus, ...filters } = values;
  const query = { ...filters, page, limit: 20 };
  const [creating, setCreating] = useState(false);

  const incidents = useQuery({
    queryKey: [...keys.incidents, 'list', query],
    queryFn: () => api<PaginatedResponse<Incident>>('incidents', { query }),
    placeholderData: keepPreviousData,
  });

  // L'incident ouvert est dans l'URL (?focus=) : lien direct depuis une alerte.
  const open = (id: string | undefined) => set({ focus: id, page });

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Signalements des chauffeurs et suivi de leur traitement."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Déclarer un incident
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <Select
            aria-label="Filtrer par statut"
            className="w-full sm:w-44"
            placeholder="Tous les statuts"
            options={options(INCIDENT_STATUS)}
            value={values.status}
            onChange={(e) => set({ status: e.target.value })}
          />
          <Select
            aria-label="Filtrer par gravité"
            className="w-full sm:w-44"
            placeholder="Toutes gravités"
            options={options(INCIDENT_SEVERITY)}
            value={values.severity}
            onChange={(e) => set({ severity: e.target.value })}
          />
          <Select
            aria-label="Filtrer par type"
            className="w-full sm:w-52"
            placeholder="Tous les types"
            options={options(INCIDENT_TYPE)}
            value={values.type}
            onChange={(e) => set({ type: e.target.value })}
          />
        </Toolbar>

        {incidents.isPending ? (
          <Spinner />
        ) : incidents.isError ? (
          <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
        ) : incidents.data.data.length === 0 ? (
          <EmptyState icon={<Siren className="size-6" />} title="Aucun incident ne correspond" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Signalé le</Th>
                  <Th>Véhicule</Th>
                  <Th>Incident</Th>
                  <Th>Gravité</Th>
                  <Th>Statut</Th>
                  <Th>Chauffeur</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.data.data.map((i) => (
                  <tr
                    key={i.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => open(i.id)}
                  >
                    <Td className="whitespace-nowrap">{formatDateTime(i.createdAt)}</Td>
                    <Td className="font-medium text-slate-900">{i.vehicle.immatriculation}</Td>
                    <Td>
                      <button
                        className="text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(i.id);
                        }}
                      >
                        <span className="flex items-center gap-1.5 font-medium text-slate-900">
                          {INCIDENT_TYPE[i.type]}
                          {i.hasPhoto && (
                            <Camera className="size-3.5 text-slate-400" aria-label="avec photo" />
                          )}
                        </span>
                        <span className="block max-w-sm truncate text-xs text-slate-500">
                          {i.description}
                        </span>
                      </button>
                    </Td>
                    <Td>
                      <StatusBadge value={INCIDENT_SEVERITY[i.severity]} />
                    </Td>
                    <Td>
                      <StatusBadge value={INCIDENT_STATUS[i.status]} />
                    </Td>
                    <Td>
                      {i.driver ? (
                        fullName(i.driver)
                      ) : (
                        <span className="text-slate-400">Gestionnaire</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={incidents.data.meta} onPage={(p) => set({ page: p, focus })} />
          </>
        )}
      </Card>

      {focus && <IncidentModal incidentId={focus} onClose={() => open(undefined)} />}
      {creating && <NewIncidentModal onClose={() => setCreating(false)} />}
    </>
  );
}
