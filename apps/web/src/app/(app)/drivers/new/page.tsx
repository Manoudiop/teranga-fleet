'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DriverForm } from '@/components/driver-form';
import { Button, Card, PageHeader, buttonClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

export default function NewDriverPage() {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  return (
    <>
      <PageHeader
        title="Nouveau chauffeur"
        description="Ajoutez un chauffeur et, si besoin, son accès à l'application mobile."
      />
      <Card className="max-w-3xl">
        <div className="p-5 sm:p-6">
          <DriverForm
            formId="driver-form"
            onPendingChange={setPending}
            onSaved={(driver) => {
              toast.success(`${driver.prenom} ${driver.nom} ajouté`);
              router.push(`/drivers/${driver.id}`);
            }}
          />
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-5">
            <Link href="/drivers" className={buttonClass('secondary')}>
              Annuler
            </Link>
            <Button type="submit" form="driver-form" loading={pending}>
              Ajouter le chauffeur
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
