'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatKm } from '@/lib/format';
import { keys } from '@/lib/queries';
import type { Vehicle } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

/** « 2026-10-11T18:30 » dans le fuseau du navigateur, pour un champ datetime-local. */
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Saisie manuelle d'un relevé par le gestionnaire. À monter uniquement à l'ouverture. */
export function MileageModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();

  const schema = z.object({
    kilometrage: z
      .string()
      .regex(/^\d+$/, 'Indiquez un nombre entier de kilomètres')
      .refine((v) => +v >= vehicle.kilometrageActuel, {
        message: `Ne peut pas être inférieur au compteur actuel (${formatKm(vehicle.kilometrageActuel)})`,
      }),
    date: z.string().min(1, 'La date est obligatoire'),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { kilometrage: '', date: nowLocal() },
  });

  const save = useMutation({
    mutationFn: (v: Values) =>
      api('mileage', {
        method: 'POST',
        body: {
          vehicleId: vehicle.id,
          kilometrage: Number(v.kilometrage),
          date: new Date(v.date).toISOString(),
        },
      }),
    onSuccess: async () => {
      await invalidate(keys.mileage, keys.vehicles, keys.maintenance);
      toast.success('Relevé enregistré');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Saisir un relevé kilométrique"
      description={`${vehicle.immatriculation} · compteur actuel ${formatKm(vehicle.kilometrageActuel)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="mileage-form" loading={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="mileage-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        <FormError error={save.error} />
        <Field
          label="Kilométrage relevé"
          htmlFor="km-value"
          error={errors.kilometrage?.message}
          required
        >
          <Input
            id="km-value"
            inputMode="numeric"
            autoFocus
            placeholder={String(vehicle.kilometrageActuel)}
            {...register('kilometrage')}
          />
        </Field>
        <Field
          label="Date et heure du relevé"
          htmlFor="km-date"
          error={errors.date?.message}
          required
        >
          <Input id="km-date" type="datetime-local" max={nowLocal()} {...register('date')} />
        </Field>
      </form>
    </Modal>
  );
}
