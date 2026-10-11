'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Card, PageHeader } from '@/components/ui/primitives';
import { VehicleForm } from '@/components/vehicle-form';
import { api } from '@/lib/api';
import { keys } from '@/lib/queries';
import type { VehicleDetail } from '@/lib/types';

export default function EditVehiclePage() {
  const { id } = useParams<{ id: string }>();
  const vehicle = useQuery({
    queryKey: [...keys.vehicles, 'detail', id],
    queryFn: () => api<VehicleDetail>(`vehicles/${id}`),
  });

  return (
    <>
      <PageHeader
        title="Modifier le véhicule"
        description={
          vehicle.data
            ? `${vehicle.data.immatriculation} · ${vehicle.data.marque} ${vehicle.data.modele}`
            : undefined
        }
      />
      {vehicle.isPending ? (
        <Spinner />
      ) : vehicle.isError ? (
        <Card>
          <ErrorState error={vehicle.error} onRetry={() => void vehicle.refetch()} />
        </Card>
      ) : (
        <VehicleForm vehicle={vehicle.data} />
      )}
    </>
  );
}
