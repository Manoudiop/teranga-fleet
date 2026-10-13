'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordRule } from '@/components/driver-form';
import { FormError, FormNotice } from '@/components/ui/feedback';
import { Button, Field, Input } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import { applyApiErrors } from '@/lib/forms';

const schema = z
  .object({ password: passwordRule, confirmation: z.string() })
  .refine((v) => v.password === v.confirmation, {
    path: ['confirmation'],
    message: 'Les deux mots de passe ne correspondent pas',
  });
type Values = z.infer<typeof schema>;

const linkClass = 'font-medium text-brand-700 hover:text-brand-800';

export function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api('auth/reset-password', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (e) {
      setError(e);
      applyApiErrors(e, setFieldError, ['password']);
    }
  });

  if (done) {
    return (
      <div className="space-y-5">
        <FormNotice>
          Votre mot de passe a été modifié. Les sessions ouvertes avec l&apos;ancien ont été
          fermées.
        </FormNotice>
        <p className="text-sm text-slate-600">
          Gestionnaires :{' '}
          <Link href="/login" className={linkClass}>
            connectez-vous au tableau de bord
          </Link>
          . Chauffeurs : connectez-vous dans l&apos;application mobile Teranga Fleet.
        </p>
      </div>
    );
  }

  const invalidLink = !token || (error instanceof ApiError && error.code === 'INVALID_RESET_TOKEN');

  if (invalidLink) {
    return (
      <div className="space-y-5">
        <FormError
          error={
            error ??
            new ApiError(
              400,
              'INVALID_RESET_TOKEN',
              'Ce lien est incomplet. Ouvrez le lien reçu par email.',
            )
          }
        />
        <Link href="/forgot-password" className={`block text-center text-sm ${linkClass}`}>
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError error={error && !errors.password ? error : null} />
      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        error={errors.password?.message}
        hint="8 caractères, une lettre et un chiffre"
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          {...register('password')}
        />
      </Field>
      <Field label="Confirmation" htmlFor="confirmation" error={errors.confirmation?.message}>
        <Input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          {...register('confirmation')}
        />
      </Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
