'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Button, Field, Input } from '@/components/ui/primitives';
import { api } from '@/lib/api';

const schema = z.object({
  email: z.email('Adresse email invalide'),
  password: z.string().min(1, 'Le mot de passe est obligatoire'),
});
type Values = z.infer<typeof schema>;

/** Seules les redirections internes sont suivies après connexion. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      // Route Next.js qui pose le cookie httpOnly : le token ne transite pas par le navigateur.
      await api('auth/login', { method: 'POST', body: values });
      queryClient.clear();
      router.replace(safeNext(params.get('next')));
    } catch (e) {
      setError(e);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError error={error} />
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" autoFocus {...register('email')} />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
      </Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Se connecter
      </Button>
      <p className="text-center text-sm text-slate-500">
        Nouvelle entreprise ?{' '}
        <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
