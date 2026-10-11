import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/primitives';
import { VehicleForm } from '@/components/vehicle-form';

export const metadata: Metadata = { title: 'Nouveau véhicule' };

export default function NewVehiclePage() {
  return (
    <>
      <PageHeader title="Nouveau véhicule" description="Ajoutez un véhicule à votre flotte." />
      <VehicleForm />
    </>
  );
}
