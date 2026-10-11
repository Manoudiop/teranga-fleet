'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { toDateInput } from '@/lib/format';
import { applyApiErrors, optional } from '@/lib/forms';
import { DRIVER_STATUS, options } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { Driver } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

export const passwordRule = z
  .string()
  .min(8, 'Au moins 8 caractères')
  .regex(/[A-Za-z]/, 'Au moins une lettre')
  .regex(/\d/, 'Au moins un chiffre');

const schema = z
  .object({
    prenom: z.string().trim().min(1, 'Le prénom est obligatoire').max(80),
    nom: z.string().trim().min(1, 'Le nom est obligatoire').max(80),
    contact: z.string().max(40),
    numeroPermis: z.string().trim().min(1, 'Le numéro de permis est obligatoire').max(40),
    dateExpirationPermis: z.string().min(1, "La date d'expiration est obligatoire"),
    statut: z.enum(['ACTIF', 'INACTIF', 'SUSPENDU']),
    withAccount: z.boolean(),
    email: z.string(),
    password: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.withAccount) return;
    if (!z.email().safeParse(v.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Adresse email invalide' });
    }
    const pwd = passwordRule.safeParse(v.password);
    if (!pwd.success)
      ctx.addIssue({ code: 'custom', path: ['password'], message: pwd.error.issues[0].message });
  });
type Values = z.infer<typeof schema>;

const API_FIELDS = {
  prenom: 'prenom',
  nom: 'nom',
  contact: 'contact',
  numeroPermis: 'numeroPermis',
  dateExpirationPermis: 'dateExpirationPermis',
  statut: 'statut',
  'compte.email': 'email',
  'compte.password': 'password',
} as const;

/**
 * Formulaire chauffeur. En création, permet de créer en même temps le compte
 * de l'application mobile ; en modification, le compte se gère à part.
 */
export function DriverForm({
  driver,
  formId,
  onSaved,
  onPendingChange,
}: {
  driver?: Driver;
  formId: string;
  onSaved: (driver: Driver) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const invalidate = useInvalidate();
  const isEdit = Boolean(driver);
  const [error, setError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    control,
    setError: setFieldError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      prenom: driver?.prenom ?? '',
      nom: driver?.nom ?? '',
      contact: driver?.contact ?? '',
      numeroPermis: driver?.numeroPermis ?? '',
      dateExpirationPermis: toDateInput(driver?.dateExpirationPermis),
      statut: driver?.statut ?? 'ACTIF',
      withAccount: false,
      email: '',
      password: '',
    },
  });
  const withAccount = useWatch({ control, name: 'withAccount' });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        prenom: v.prenom,
        nom: v.nom,
        contact: optional(v.contact),
        numeroPermis: v.numeroPermis,
        dateExpirationPermis: v.dateExpirationPermis,
        statut: v.statut,
      };
      return isEdit
        ? api<Driver>(`drivers/${driver!.id}`, { method: 'PATCH', body })
        : api<Driver>('drivers', {
            method: 'POST',
            body: {
              ...body,
              ...(v.withAccount && { compte: { email: v.email, password: v.password } }),
            },
          });
    },
    onMutate: () => {
      setError(null);
      onPendingChange?.(true);
    },
    onSettled: () => onPendingChange?.(false),
    onSuccess: async (saved) => {
      await invalidate(keys.drivers, keys.vehicles, keys.assignments);
      onSaved(saved);
    },
    onError: (e) => {
      if (!applyApiErrors(e, setFieldError, API_FIELDS)) setError(e);
    },
  });

  return (
    <form
      id={formId}
      onSubmit={handleSubmit((v) => save.mutate(v))}
      noValidate
      className="space-y-5"
    >
      <FormError error={error} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="drv-prenom" error={errors.prenom?.message} required>
          <Input id="drv-prenom" autoComplete="off" {...register('prenom')} />
        </Field>
        <Field label="Nom" htmlFor="drv-nom" error={errors.nom?.message} required>
          <Input id="drv-nom" autoComplete="off" {...register('nom')} />
        </Field>
        <Field label="Téléphone" htmlFor="drv-contact" error={errors.contact?.message}>
          <Input
            id="drv-contact"
            type="tel"
            placeholder="+221 77 000 00 00"
            {...register('contact')}
          />
        </Field>
        <Field label="Statut" htmlFor="drv-statut" error={errors.statut?.message} required>
          <Select id="drv-statut" options={options(DRIVER_STATUS)} {...register('statut')} />
        </Field>
        <Field
          label="Numéro de permis"
          htmlFor="drv-permis"
          error={errors.numeroPermis?.message}
          required
        >
          <Input id="drv-permis" className="uppercase" {...register('numeroPermis')} />
        </Field>
        <Field
          label="Expiration du permis"
          htmlFor="drv-permis-exp"
          error={errors.dateExpirationPermis?.message}
          required
        >
          <Input id="drv-permis-exp" type="date" {...register('dateExpirationPermis')} />
        </Field>
      </div>

      {!isEdit && (
        <fieldset className="rounded-lg bg-slate-50 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
              {...register('withAccount')}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">
                Créer son accès à l&apos;application mobile
              </span>
              <span className="block text-sm text-slate-500">
                Le chauffeur pourra saisir son kilométrage et signaler des incidents depuis son
                téléphone.
              </span>
            </span>
          </label>
          {withAccount && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Email de connexion"
                htmlFor="drv-email"
                error={errors.email?.message}
                required
              >
                <Input id="drv-email" type="email" autoComplete="off" {...register('email')} />
              </Field>
              <Field
                label="Mot de passe provisoire"
                htmlFor="drv-password"
                error={errors.password?.message}
                hint="8 caractères, une lettre et un chiffre"
                required
              >
                <Input
                  id="drv-password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                />
              </Field>
            </div>
          )}
        </fieldset>
      )}
    </form>
  );
}
