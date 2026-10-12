'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Plus, UserX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AssignModal, EndAssignmentModal } from '@/components/modals/assignment-modals';
import { EmptyState, ErrorState, Pagination, Spinner, Toolbar } from '@/components/ui/feedback';
import { Badge, Button, Card, PageHeader, Select, Table, Td, Th } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatDateTime, fullName } from '@/lib/format';
import { DriverPicker, VehiclePicker } from '@/components/entity-pickers';
import { keys } from '@/lib/queries';
import type { Assignment } from '@/lib/types';
import { useUrlState } from '@/lib/use-url-state';

const ACTIVE_FILTER = [
  { value: 'true', label: 'En cours' },
  { value: 'false', label: 'Terminées' },
];

export default function AssignmentsPage() {
  const { values, page, set } = useUrlState(['active', 'vehicleId', 'driverId'] as const);
  const query = { ...values, page, limit: 20 };
  const [assigning, setAssigning] = useState(false);
  const [ending, setEnding] = useState<Assignment | null>(null);

  const assignments = useQuery({
    queryKey: [...keys.assignments, 'list', query],
    queryFn: () => api<PaginatedResponse<Assignment>>('assignments', { query }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Affectations"
        description="Qui conduit quel véhicule, et depuis quand."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setAssigning(true)}>
            Nouvelle affectation
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <Select
            aria-label="Filtrer par état"
            className="w-full sm:w-40"
            placeholder="Toutes"
            options={ACTIVE_FILTER}
            value={values.active}
            onChange={(e) => set({ active: e.target.value })}
          />
          <VehiclePicker
            aria-label="Filtrer par véhicule"
            className="w-full sm:w-56"
            placeholder="Tous les véhicules"
            clearLabel="Tous les véhicules"
            value={values.vehicleId}
            onChange={(vehicleId) => set({ vehicleId })}
          />
          <DriverPicker
            aria-label="Filtrer par chauffeur"
            className="w-full sm:w-56"
            placeholder="Tous les chauffeurs"
            clearLabel="Tous les chauffeurs"
            value={values.driverId}
            onChange={(driverId) => set({ driverId })}
          />
        </Toolbar>

        {assignments.isPending ? (
          <Spinner />
        ) : assignments.isError ? (
          <ErrorState error={assignments.error} onRetry={() => void assignments.refetch()} />
        ) : assignments.data.data.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight className="size-6" />} title="Aucune affectation" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Véhicule</Th>
                  <Th>Chauffeur</Th>
                  <Th>Début</Th>
                  <Th>Fin</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.data.data.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <Link
                        href={`/vehicles/${a.vehicle.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {a.vehicle.immatriculation}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {a.vehicle.marque} {a.vehicle.modele}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/drivers/${a.driver.id}`}
                        className="text-slate-900 hover:text-brand-700"
                      >
                        {fullName(a.driver)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDateTime(a.dateDebut)}</Td>
                    <Td className="whitespace-nowrap">
                      {a.active ? (
                        <Badge tone="success">En cours</Badge>
                      ) : (
                        formatDateTime(a.dateFin)
                      )}
                    </Td>
                    <Td className="text-right">
                      {a.active && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<UserX className="size-4" />}
                          onClick={() => setEnding(a)}
                        >
                          Terminer
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={assignments.data.meta} onPage={(p) => set({ page: p })} />
          </>
        )}
      </Card>

      {assigning && <AssignModal onClose={() => setAssigning(false)} />}
      {ending && (
        <EndAssignmentModal
          assignment={{
            id: ending.id,
            dateDebut: ending.dateDebut,
            label: `${fullName(ending.driver)} sur ${ending.vehicle.immatriculation}`,
          }}
          onClose={() => setEnding(null)}
        />
      )}
    </>
  );
}
