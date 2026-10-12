'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Role } from '@teranga-fleet/shared';
import { KeyRound, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordRule } from '@/components/driver-form';
import { EmptyState, FormError } from '@/components/ui/feedback';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import { Badge, Button, Field, Input, Table, Td, Th } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { applyApiErrors } from '@/lib/forms';

export interface Account {
  id: string;
  nom: string;
  email: string;
  role: Role;
  disabledAt: string | null;
  createdAt: string;
  driver: { id: string; nom: string; prenom: string } | null;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
  CHAUFFEUR: 'Chauffeur',
};

/**
 * Liste de comptes avec désactivation / réactivation et nouveau mot de passe.
 * `basePath` : « users » (équipe du gestionnaire) ou « admin/users » (plateforme).
 */
export function AccountsTable({
  accounts,
  currentUserId,
  basePath,
  invalidate,
  showRole,
}: {
  accounts: Account[];
  currentUserId?: string;
  basePath: 'users' | 'admin/users';
  invalidate: QueryKey;
  showRole?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [disabling, setDisabling] = useState<Account | null>(null);
  const [resetting, setResetting] = useState<Account | null>(null);

  const toggle = useMutation({
    mutationFn: ({ account, disabled }: { account: Account; disabled: boolean }) =>
      api(`${basePath}/${account.id}`, { method: 'PATCH', body: { disabled } }),
    onSuccess: async (_data, { account, disabled }) => {
      await queryClient.invalidateQueries({ queryKey: invalidate });
      toast.success(
        disabled ? `Compte de ${account.nom} désactivé` : `Compte de ${account.nom} réactivé`,
      );
      setDisabling(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Action impossible'),
  });

  if (accounts.length === 0) return <EmptyState title="Aucun compte" />;

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Compte</Th>
            {showRole && <Th>Rôle</Th>}
            <Th>Créé le</Th>
            <Th>État</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {accounts.map((account) => {
            const self = account.id === currentUserId;
            return (
              <tr key={account.id} className={account.disabledAt ? 'bg-slate-50/60' : undefined}>
                <Td>
                  <span className="font-medium text-slate-900">
                    {account.driver ? fullName(account.driver) : account.nom}
                    {self && (
                      <span className="ml-2 text-xs font-normal text-slate-500">(vous)</span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{account.email}</span>
                </Td>
                {showRole && <Td>{ROLE_LABELS[account.role]}</Td>}
                <Td>{formatDate(account.createdAt)}</Td>
                <Td>
                  {account.disabledAt ? (
                    <Badge tone="neutral">Désactivé le {formatDate(account.disabledAt)}</Badge>
                  ) : (
                    <Badge tone="success">Actif</Badge>
                  )}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<KeyRound className="size-4" />}
                    onClick={() => setResetting(account)}
                    aria-label={`Nouveau mot de passe pour ${account.nom}`}
                    title="Nouveau mot de passe"
                  />
                  {!self &&
                    (account.disabledAt ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<UserCheck className="size-4" />}
                        loading={toggle.isPending && toggle.variables?.account.id === account.id}
                        onClick={() => toggle.mutate({ account, disabled: false })}
                        aria-label={`Réactiver ${account.nom}`}
                        title="Réactiver"
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<UserX className="size-4" />}
                        onClick={() => setDisabling(account)}
                        aria-label={`Désactiver ${account.nom}`}
                        title="Désactiver"
                      />
                    ))}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {disabling && (
        <ConfirmModal
          open
          onClose={() => setDisabling(null)}
          onConfirm={() => toggle.mutate({ account: disabling, disabled: true })}
          loading={toggle.isPending}
          confirmLabel="Désactiver"
          title={`Désactiver le compte de ${disabling.nom} ?`}
          message="La personne ne pourra plus se connecter et ses sessions en cours seront coupées. Le compte peut être réactivé à tout moment ; aucune donnée n'est supprimée."
        />
      )}
      {resetting && (
        <PasswordModal
          endpoint={`${basePath}/${resetting.id}/password`}
          name={resetting.nom}
          onClose={() => setResetting(null)}
        />
      )}
    </>
  );
}

const passwordSchema = z.object({ password: passwordRule });

/** Définit un nouveau mot de passe pour un autre compte (à communiquer à la personne). */
export function PasswordModal({
  endpoint,
  name,
  onClose,
}: {
  endpoint: string;
  name: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<{ password: string }>({ resolver: zodResolver(passwordSchema) });
  const save = useMutation({
    mutationFn: (v: { password: string }) => api(endpoint, { method: 'PUT', body: v }),
    onSuccess: () => {
      toast.success(`Mot de passe de ${name} mis à jour`);
      onClose();
    },
    onError: (e) => applyApiErrors(e, setError, ['password']),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Nouveau mot de passe pour ${name}`}
      description="Communiquez-le à la personne : elle pourra le changer depuis « Mon compte »."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="password-form" loading={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="password-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        <FormError error={save.isError && !errors.password ? save.error : null} />
        <Field
          label="Mot de passe provisoire"
          htmlFor="new-password"
          error={errors.password?.message}
          hint="8 caractères, une lettre et un chiffre"
          required
        >
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
      </form>
    </Modal>
  );
}

const accountSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire').max(120),
  email: z.email('Adresse email invalide'),
  password: passwordRule,
});
type AccountValues = z.infer<typeof accountSchema>;

/** Création d'un compte gestionnaire (équipe ou administration). */
export function NewAccountModal({
  endpoint,
  title,
  invalidate,
  onClose,
}: {
  endpoint: string;
  title: string;
  invalidate: QueryKey;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AccountValues>({ resolver: zodResolver(accountSchema) });
  const save = useMutation({
    mutationFn: (v: AccountValues) => api<Account>(endpoint, { method: 'POST', body: v }),
    onSuccess: async (account) => {
      await queryClient.invalidateQueries({ queryKey: invalidate });
      toast.success(`Compte de ${account.nom} créé`);
      onClose();
    },
    onError: (e) => applyApiErrors(e, setError, ['nom', 'email', 'password']),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description="Communiquez l'email et le mot de passe provisoire à la personne."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="account-create-form" loading={save.isPending}>
            Créer le compte
          </Button>
        </>
      }
    >
      <form
        id="account-create-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        <FormError error={save.isError && !Object.keys(errors).length ? save.error : null} />
        <Field label="Nom complet" htmlFor="acc-nom" error={errors.nom?.message} required>
          <Input id="acc-nom" autoComplete="off" {...register('nom')} />
        </Field>
        <Field
          label="Email de connexion"
          htmlFor="acc-email"
          error={errors.email?.message}
          required
        >
          <Input id="acc-email" type="email" autoComplete="off" {...register('email')} />
        </Field>
        <Field
          label="Mot de passe provisoire"
          htmlFor="acc-pwd"
          error={errors.password?.message}
          hint="8 caractères, une lettre et un chiffre"
          required
        >
          <Input
            id="acc-pwd"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
      </form>
    </Modal>
  );
}
