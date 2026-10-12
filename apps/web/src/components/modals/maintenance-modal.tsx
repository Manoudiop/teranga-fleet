'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { VehiclePicker } from '@/components/entity-pickers';
import { api } from '@/lib/api';
import { toDateInput, todayIso } from '@/lib/format';
import { applyApiErrors, optional } from '@/lib/forms';
import { keys } from '@/lib/queries';
import type { MaintenanceRecord } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

const intString = (message: string) => z.string().refine((v) => !v || /^\d+$/.test(v), message);

const schema = z
  .object({
    vehicleId: z.string().min(1, 'Choisissez un véhicule'),
    type: z.string().trim().min(1, "Le type d'intervention est obligatoire").max(120),
    date: z.string().min(1, 'La date est obligatoire'),
    kilometrageAuMoment: z.string().regex(/^\d+$/, 'Kilométrage obligatoire (nombre entier)'),
    cout: z.string().regex(/^\d+$/, 'Coût obligatoire, en francs CFA'),
    garage: z.string().max(150),
    notes: z.string().max(2000),
    prochainEntretienKm: intString('Kilométrage invalide'),
    prochainEntretienDate: z.string(),
  })
  .refine((v) => v.date <= todayIso(), {
    path: ['date'],
    message: 'La date ne peut pas être dans le futur',
  })
  .refine((v) => !v.prochainEntretienKm || +v.prochainEntretienKm > +v.kilometrageAuMoment, {
    path: ['prochainEntretienKm'],
    message: 'Doit dépasser le kilométrage de cet entretien',
  })
  .refine((v) => !v.prochainEntretienDate || v.prochainEntretienDate > v.date, {
    path: ['prochainEntretienDate'],
    message: 'Doit être postérieure à cet entretien',
  });
type Values = z.infer<typeof schema>;

const FIELDS = [
  'type',
  'date',
  'kilometrageAuMoment',
  'cout',
  'garage',
  'notes',
  'prochainEntretienKm',
  'prochainEntretienDate',
] as const;

/** Enregistrement ou modification d'un entretien. À monter uniquement à l'ouverture. */
export function MaintenanceModal({
  onClose,
  vehicleId,
  record,
  currentKm,
}: {
  onClose: () => void;
  vehicleId?: string;
  record?: MaintenanceRecord;
  /** Compteur du véhicule, proposé par défaut. */
  currentKm?: number;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const isEdit = Boolean(record);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: record?.vehicleId ?? vehicleId ?? '',
      type: record?.type ?? '',
      date: toDateInput(record?.date) || todayIso(),
      kilometrageAuMoment: String(record?.kilometrageAuMoment ?? currentKm ?? ''),
      cout: record ? String(record.cout) : '',
      garage: record?.garage ?? '',
      notes: record?.notes ?? '',
      prochainEntretienKm: record?.prochainEntretienKm ? String(record.prochainEntretienKm) : '',
      prochainEntretienDate: toDateInput(record?.prochainEntretienDate),
    },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        type: v.type,
        date: v.date,
        kilometrageAuMoment: Number(v.kilometrageAuMoment),
        cout: Number(v.cout),
        garage: optional(v.garage),
        notes: optional(v.notes),
        prochainEntretienKm: v.prochainEntretienKm ? Number(v.prochainEntretienKm) : undefined,
        prochainEntretienDate: optional(v.prochainEntretienDate),
      };
      return isEdit
        ? api(`maintenance/${record!.id}`, { method: 'PATCH', body })
        : api('maintenance', { method: 'POST', body: { ...body, vehicleId: v.vehicleId } });
    },
    onSuccess: async () => {
      await invalidate(keys.maintenance, keys.vehicles, keys.mileage);
      toast.success(isEdit ? 'Entretien mis à jour' : 'Entretien enregistré');
      onClose();
    },
    onError: (error) => applyApiErrors(error, setError, FIELDS),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? "Modifier l'entretien" : 'Enregistrer un entretien'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="maintenance-form" loading={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="maintenance-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        <FormError error={save.isError && !Object.keys(errors).length ? save.error : null} />
        {!vehicleId && !isEdit && (
          <Field label="Véhicule" htmlFor="mnt-vehicle" error={errors.vehicleId?.message} required>
            <Controller
              control={control}
              name="vehicleId"
              render={({ field }) => (
                <VehiclePicker
                  id="mnt-vehicle"
                  placeholder="Rechercher un véhicule"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.vehicleId)}
                />
              )}
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Intervention"
            htmlFor="mnt-type"
            error={errors.type?.message}
            required
            className="sm:col-span-2"
          >
            <Input id="mnt-type" placeholder="Vidange moteur + filtres" {...register('type')} />
          </Field>
          <Field label="Date" htmlFor="mnt-date" error={errors.date?.message} required>
            <Input id="mnt-date" type="date" max={todayIso()} {...register('date')} />
          </Field>
          <Field
            label="Kilométrage"
            htmlFor="mnt-km"
            error={errors.kilometrageAuMoment?.message}
            required
          >
            <Input id="mnt-km" inputMode="numeric" {...register('kilometrageAuMoment')} />
          </Field>
          <Field label="Coût (F CFA)" htmlFor="mnt-cout" error={errors.cout?.message} required>
            <Input id="mnt-cout" inputMode="numeric" placeholder="45000" {...register('cout')} />
          </Field>
          <Field label="Garage" htmlFor="mnt-garage" error={errors.garage?.message}>
            <Input id="mnt-garage" {...register('garage')} />
          </Field>
        </div>
        <fieldset className="rounded-lg bg-slate-50 p-4">
          <legend className="sr-only">Prochain entretien</legend>
          <p className="mb-3 text-sm font-medium text-slate-700">
            Prochain entretien{' '}
            <span className="font-normal text-slate-500">(déclenche les alertes)</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Au kilométrage"
              htmlFor="mnt-next-km"
              error={errors.prochainEntretienKm?.message}
            >
              <Input id="mnt-next-km" inputMode="numeric" {...register('prochainEntretienKm')} />
            </Field>
            <Field
              label="À la date"
              htmlFor="mnt-next-date"
              error={errors.prochainEntretienDate?.message}
            >
              <Input id="mnt-next-date" type="date" {...register('prochainEntretienDate')} />
            </Field>
          </div>
        </fieldset>
        <Field label="Notes" htmlFor="mnt-notes" error={errors.notes?.message}>
          <Textarea id="mnt-notes" rows={3} {...register('notes')} />
        </Field>
      </form>
    </Modal>
  );
}
