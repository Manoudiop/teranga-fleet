'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Button, Field, Input } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { applyApiErrors, optional } from '@/lib/forms';

const schema = z.object({
  companyName: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire").max(150),
  companyEmail: z.email('Adresse email invalide'),
  companyPhone: z.string().max(30).optional(),
  companyAddress: z.string().max(255).optional(),
  managerName: z.string().trim().min(1, 'Votre nom est obligatoire').max(120),
  email: z.email('Adresse email invalide'),
  password: z
    .string()
    .min(8, 'Au moins 8 caractères')
    .regex(/[A-Za-z]/, 'Au moins une lettre')
    .regex(/\d/, 'Au moins un chiffre'),
});
type Values = z.infer<typeof schema>;

/** Champs de l'API → champs du formulaire, pour afficher ses erreurs au bon endroit. */
const API_FIELDS: Record<string, keyof Values> = {
  'entreprise.nom': 'companyName',
  'entreprise.email': 'companyEmail',
  'entreprise.telephone': 'companyPhone',
  'entreprise.adresse': 'companyAddress',
  'gestionnaire.nom': 'managerName',
  'gestionnaire.email': 'email',
  'gestionnaire.password': 'password',
};

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api('auth/register', {
        method: 'POST',
        body: {
          entreprise: {
            nom: v.companyName,
            email: v.companyEmail,
            telephone: optional(v.companyPhone),
            adresse: optional(v.companyAddress),
          },
          gestionnaire: { nom: v.managerName, email: v.email, password: v.password },
        },
      });
      queryClient.clear();
      router.replace('/dashboard');
    } catch (e) {
      if (!applyApiErrors(e, setFieldError, API_FIELDS)) setError(e);
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Créer votre espace</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Inscrivez votre entreprise et devenez gestionnaire de sa flotte.
      </p>
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FormError error={error} />
        <fieldset className="space-y-4">
          <legend className="mb-3 text-sm font-semibold text-slate-900">Entreprise</legend>
          <Field
            label="Raison sociale"
            htmlFor="companyName"
            error={errors.companyName?.message}
            required
          >
            <Input id="companyName" autoComplete="organization" {...register('companyName')} />
          </Field>
          <Field
            label="Email de contact"
            htmlFor="companyEmail"
            error={errors.companyEmail?.message}
            required
          >
            <Input id="companyEmail" type="email" {...register('companyEmail')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone" htmlFor="companyPhone" error={errors.companyPhone?.message}>
              <Input
                id="companyPhone"
                type="tel"
                placeholder="+221 33 000 00 00"
                {...register('companyPhone')}
              />
            </Field>
            <Field label="Adresse" htmlFor="companyAddress" error={errors.companyAddress?.message}>
              <Input id="companyAddress" placeholder="Dakar" {...register('companyAddress')} />
            </Field>
          </div>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-3 text-sm font-semibold text-slate-900">
            Votre compte gestionnaire
          </legend>
          <Field
            label="Nom complet"
            htmlFor="managerName"
            error={errors.managerName?.message}
            required
          >
            <Input id="managerName" autoComplete="name" {...register('managerName')} />
          </Field>
          <Field label="Email de connexion" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field
            label="Mot de passe"
            htmlFor="password"
            error={errors.password?.message}
            hint="8 caractères minimum, avec au moins une lettre et un chiffre"
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
          </Field>
        </fieldset>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Créer mon espace
        </Button>
        <p className="text-center text-sm text-slate-500">
          Déjà inscrit ?{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Se connecter
          </Link>
        </p>
      </form>
    </>
  );
}
