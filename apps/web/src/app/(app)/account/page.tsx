'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AuthUserResponse } from '@teranga-fleet/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordRule } from '@/components/driver-form';
import { FormError } from '@/components/ui/feedback';
import { Button, Card, CardHeader, Field, Input, PageHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { applyApiErrors } from '@/lib/forms';
import { keys, useMe } from '@/lib/queries';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est obligatoire'),
    newPassword: passwordRule,
    confirmation: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmation, {
    path: ['confirmation'],
    message: 'Les deux mots de passe ne correspondent pas',
  });
type Values = z.infer<typeof schema>;

export default function AccountPage() {
  const me = useMe();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const save = useMutation({
    mutationFn: ({ currentPassword, newPassword }: Values) =>
      api('auth/password', { method: 'PUT', body: { currentPassword, newPassword } }),
    onSuccess: () => {
      toast.success('Mot de passe modifié');
      reset();
    },
    onError: (e) => {
      // Le mot de passe actuel erroné est signalé sous son champ.
      if (e instanceof Error && 'code' in e && e.code === 'INVALID_CREDENTIALS') {
        setError('currentPassword', { message: e.message });
        return;
      }
      applyApiErrors(e, setError, ['currentPassword', 'newPassword']);
    },
  });

  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader title="Profil" />
          <dl className="grid gap-4 px-5 py-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Nom</dt>
              <dd className="font-medium text-slate-900">{me.data?.nom}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email de connexion</dt>
              <dd className="font-medium text-slate-900">{me.data?.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Entreprise</dt>
              <dd className="font-medium text-slate-900">
                {me.data?.company?.nom ?? 'Plateforme'}
              </dd>
            </div>
          </dl>
        </Card>

        {me.data?.role === 'GESTIONNAIRE' && <NotificationsCard enabled={me.data.alertDigest} />}

        <Card>
          <CardHeader title="Changer de mot de passe" />
          <form
            onSubmit={handleSubmit((v) => save.mutate(v))}
            noValidate
            className="space-y-4 px-5 py-5"
          >
            <FormError error={save.isError && !Object.keys(errors).length ? save.error : null} />
            <Field
              label="Mot de passe actuel"
              htmlFor="pwd-current"
              error={errors.currentPassword?.message}
              required
            >
              <Input
                id="pwd-current"
                type="password"
                autoComplete="current-password"
                {...register('currentPassword')}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nouveau mot de passe"
                htmlFor="pwd-new"
                error={errors.newPassword?.message}
                hint="8 caractères, une lettre et un chiffre"
                required
              >
                <Input
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  {...register('newPassword')}
                />
              </Field>
              <Field
                label="Confirmation"
                htmlFor="pwd-confirm"
                error={errors.confirmation?.message}
                required
              >
                <Input
                  id="pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmation')}
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending}>
                Changer le mot de passe
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

/** Abonnement au récapitulatif quotidien des alertes (gestionnaires). */
function NotificationsCard({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (alertDigest: boolean) =>
      api<AuthUserResponse>('auth/preferences', { method: 'PATCH', body: { alertDigest } }),
    onSuccess: (user) => {
      queryClient.setQueryData(keys.me, user);
      toast.success(
        user.alertDigest ? 'Récapitulatif quotidien activé' : 'Récapitulatif quotidien désactivé',
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Action impossible'),
  });

  return (
    <Card>
      <CardHeader title="Notifications" />
      <label className="flex cursor-pointer items-start gap-3 px-5 py-5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          checked={enabled}
          disabled={save.isPending}
          onChange={(e) => save.mutate(e.target.checked)}
        />
        <span>
          <span className="block font-medium text-slate-900">
            Récapitulatif quotidien des alertes par email
          </span>
          <span className="block text-slate-500">
            Chaque matin, la liste des alertes critiques et à surveiller de la flotte (documents,
            permis, entretiens, incidents), avec les nouveautés de la veille. Aucun email les jours
            sans alerte.
          </span>
        </span>
      </label>
    </Card>
  );
}
