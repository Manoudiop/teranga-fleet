'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Button, Card, Field, Input, Select, buttonClass } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { toDateInput } from '@/lib/format';
import { applyApiErrors, optional } from '@/lib/forms';
import { VEHICLE_STATUS, options } from '@/lib/labels';
import { DERIVED, keys } from '@/lib/queries';
import type { Vehicle } from '@/lib/types';

const maxYear = new Date().getFullYear() + 1;

const schema = z.object({
  immatriculation: z
    .string()
    .trim()
    .min(3, "L'immatriculation est obligatoire")
    .max(20)
    .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, 'Lettres, chiffres, espaces et tirets uniquement'),
  marque: z.string().trim().min(1, 'La marque est obligatoire').max(60),
  modele: z.string().trim().min(1, 'Le modèle est obligatoire').max(60),
  annee: z
    .string()
    .refine(
      (v) => !v || (/^\d{4}$/.test(v) && +v >= 1950 && +v <= maxYear),
      `Année entre 1950 et ${maxYear}`,
    ),
  type: z.string().max(40),
  dateAcquisition: z.string(),
  statut: z.enum(['ACTIVE', 'MAINTENANCE', 'HORS_SERVICE']),
  kilometrageActuel: z
    .string()
    .refine((v) => !v || (/^\d+$/.test(v) && +v <= 5_000_000), 'Kilométrage invalide'),
});
type Values = z.infer<typeof schema>;

const FIELDS = [
  'immatriculation',
  'marque',
  'modele',
  'annee',
  'type',
  'dateAcquisition',
  'statut',
  'kilometrageActuel',
] as const;

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(vehicle);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      immatriculation: vehicle?.immatriculation ?? '',
      marque: vehicle?.marque ?? '',
      modele: vehicle?.modele ?? '',
      annee: vehicle?.annee ? String(vehicle.annee) : '',
      type: vehicle?.type ?? '',
      dateAcquisition: toDateInput(vehicle?.dateAcquisition),
      statut: vehicle?.statut ?? 'ACTIVE',
      kilometrageActuel: '',
    },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        immatriculation: v.immatriculation,
        marque: v.marque,
        modele: v.modele,
        annee: v.annee ? Number(v.annee) : undefined,
        type: optional(v.type),
        dateAcquisition: optional(v.dateAcquisition),
        statut: v.statut,
        ...(!isEdit && v.kilometrageActuel && { kilometrageActuel: Number(v.kilometrageActuel) }),
      };
      return isEdit
        ? api<Vehicle>(`vehicles/${vehicle!.id}`, { method: 'PATCH', body })
        : api<Vehicle>('vehicles', { method: 'POST', body });
    },
    onSuccess: async (saved) => {
      await Promise.all(
        [keys.vehicles, ...DERIVED].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      toast.success(isEdit ? 'Véhicule mis à jour' : `Véhicule ${saved.immatriculation} ajouté`);
      router.push(`/vehicles/${saved.id}`);
    },
    onError: (error) => applyApiErrors(error, setError, FIELDS),
  });

  return (
    <Card className="max-w-3xl">
      <form
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-5 p-5 sm:p-6"
      >
        {save.isError && !Object.keys(errors).length && <FormError error={save.error} />}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Immatriculation"
            htmlFor="immatriculation"
            error={errors.immatriculation?.message}
            required
          >
            <Input
              id="immatriculation"
              placeholder="DK-4521-AB"
              className="uppercase"
              {...register('immatriculation')}
            />
          </Field>
          <Field label="Statut" htmlFor="statut" error={errors.statut?.message} required>
            <Select id="statut" options={options(VEHICLE_STATUS)} {...register('statut')} />
          </Field>
          <Field label="Marque" htmlFor="marque" error={errors.marque?.message} required>
            <Input id="marque" placeholder="Toyota" {...register('marque')} />
          </Field>
          <Field label="Modèle" htmlFor="modele" error={errors.modele?.message} required>
            <Input id="modele" placeholder="Hilux" {...register('modele')} />
          </Field>
          <Field
            label="Type"
            htmlFor="type"
            error={errors.type?.message}
            hint="Pick-up, utilitaire, minibus, camion…"
          >
            <Input id="type" {...register('type')} />
          </Field>
          <Field label="Année" htmlFor="annee" error={errors.annee?.message}>
            <Input id="annee" inputMode="numeric" placeholder="2019" {...register('annee')} />
          </Field>
          <Field
            label="Date d'acquisition"
            htmlFor="dateAcquisition"
            error={errors.dateAcquisition?.message}
          >
            <Input id="dateAcquisition" type="date" {...register('dateAcquisition')} />
          </Field>
          {isEdit ? (
            <Field label="Kilométrage" htmlFor="km" hint="Mis à jour par les relevés kilométriques">
              <Input
                id="km"
                disabled
                value={`${vehicle!.kilometrageActuel.toLocaleString('fr-FR')} km`}
              />
            </Field>
          ) : (
            <Field
              label="Kilométrage actuel"
              htmlFor="kilometrageActuel"
              error={errors.kilometrageActuel?.message}
              hint="Il évoluera ensuite par les relevés"
            >
              <Input
                id="kilometrageActuel"
                inputMode="numeric"
                placeholder="0"
                {...register('kilometrageActuel')}
              />
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
          <Link
            href={isEdit ? `/vehicles/${vehicle!.id}` : '/vehicles'}
            className={buttonClass('secondary')}
          >
            Annuler
          </Link>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Enregistrer' : 'Ajouter le véhicule'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
