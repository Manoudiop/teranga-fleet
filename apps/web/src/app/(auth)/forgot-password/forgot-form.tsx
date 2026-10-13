'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError, FormNotice } from '@/components/ui/feedback';
import { Button, Field, Input } from '@/components/ui/primitives';
import { api } from '@/lib/api';

const schema = z.object({ email: z.email('Adresse email invalide') });
type Values = z.infer<typeof schema>;

export function ForgotForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await api('auth/forgot-password', { method: 'POST', body: { email } });
      setSentTo(email);
    } catch (e) {
      setError(e);
    }
  });

  return (
    <>
      {sentTo ? (
        <div className="space-y-5">
          {/* Même message que le compte existe ou non : on ne révèle pas les comptes existants. */}
          <FormNotice>
            Si un compte existe pour <strong>{sentTo}</strong>, un email vient de lui être envoyé.
            Le lien est valable une heure. Pensez à vérifier les courriers indésirables.
          </FormNotice>
          <Link
            href="/login"
            className="block text-center text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormError error={error} />
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Recevoir le lien
          </Button>
          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
              Retour à la connexion
            </Link>
          </p>
        </form>
      )}
    </>
  );
}
