'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Pencil, Smartphone, Trash2, UserPlus, UserX } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DriverForm, passwordRule } from '@/components/driver-form';
import { AssignModal, EndAssignmentModal } from '@/components/modals/assignment-modals';
import { EmptyState, ErrorState, FormError, Spinner } from '@/components/ui/feedback';
import { ConfirmModal, Modal } from '@/components/ui/modal';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatKm, fullName } from '@/lib/format';
import { applyApiErrors } from '@/lib/forms';
import { DRIVER_STATUS, EXPIRY_STATUS } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { DriverDetail } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

type ModalState = 'edit' | 'account' | 'assign' | 'endAssignment' | 'delete';

export default function DriverPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [editPending, setEditPending] = useState(false);
  const close = () => setModal(null);

  const driver = useQuery({
    queryKey: [...keys.drivers, 'detail', id],
    queryFn: () => api<DriverDetail>(`drivers/${id}`),
  });

  if (driver.isPending) return <Spinner />;
  if (driver.isError) {
    return (
      <Card>
        <ErrorState error={driver.error} onRetry={() => void driver.refetch()} />
      </Card>
    );
  }
  const d = driver.data;

  return (
    <>
      <Link
        href="/drivers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" aria-hidden /> Chauffeurs
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{fullName(d)}</h1>
            <StatusBadge value={DRIVER_STATUS[d.statut]} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{d.contact ?? 'Pas de téléphone'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<Pencil className="size-4" />}
            onClick={() => setModal('edit')}
          >
            Modifier
          </Button>
          <Button
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            onClick={() => setModal('delete')}
            aria-label="Supprimer le chauffeur"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Permis de conduire" />
          <dl className="space-y-4 px-5 py-5 text-sm">
            <Info label="Numéro">{d.numeroPermis}</Info>
            <Info label="Expiration">
              <span className="flex items-center gap-2">
                {formatDate(d.dateExpirationPermis)}
                <StatusBadge value={EXPIRY_STATUS[d.permisStatus]} />
              </span>
            </Info>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Véhicule actuel" />
          <div className="px-5 py-5">
            {d.currentVehicle ? (
              <div className="space-y-4">
                <div>
                  <Link
                    href={`/vehicles/${d.currentVehicle.id}`}
                    className="text-base font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {d.currentVehicle.immatriculation}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {d.currentVehicle.marque} {d.currentVehicle.modele} ·{' '}
                    {formatKm(d.currentVehicle.kilometrageActuel)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Depuis le {formatDateTime(d.currentAssignment!.dateDebut)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<UserX className="size-4" />}
                  onClick={() => setModal('endAssignment')}
                >
                  Terminer l&apos;affectation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">Aucun véhicule affecté.</p>
                {d.statut === 'ACTIF' && d.permisStatus !== 'EXPIRE' ? (
                  <Button
                    size="sm"
                    icon={<UserPlus className="size-4" />}
                    onClick={() => setModal('assign')}
                  >
                    Affecter un véhicule
                  </Button>
                ) : (
                  <p className="text-sm text-amber-700">
                    {d.statut !== 'ACTIF'
                      ? 'Un chauffeur non actif ne peut pas être affecté.'
                      : 'Permis expiré : affectation impossible.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Application mobile" />
          <div className="space-y-4 px-5 py-5">
            {d.account ? (
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <span>
                  Accès activé
                  <span className="block font-medium text-slate-900">{d.account.email}</span>
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Ce chauffeur n&apos;a pas encore d&apos;accès à l&apos;application.
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<KeyRound className="size-4" />}
              onClick={() => setModal('account')}
            >
              {d.account ? 'Changer les identifiants' : "Créer l'accès"}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Historique des affectations" />
        {d.assignments.length === 0 ? (
          <EmptyState title="Aucune affectation" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Véhicule</Th>
                <Th>Début</Th>
                <Th>Fin</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.assignments.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <Link
                      href={`/vehicles/${a.vehicle.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {a.vehicle.immatriculation}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {a.vehicle.marque} {a.vehicle.modele}
                    </span>
                  </Td>
                  <Td>{formatDateTime(a.dateDebut)}</Td>
                  <Td>{a.dateFin ? formatDateTime(a.dateFin) : '—'}</Td>
                  <Td>{!a.dateFin && <Badge tone="success">En cours</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {modal === 'edit' && (
        <Modal
          open
          onClose={close}
          size="lg"
          title="Modifier le chauffeur"
          footer={
            <>
              <Button variant="secondary" onClick={close}>
                Annuler
              </Button>
              <Button type="submit" form="driver-edit-form" loading={editPending}>
                Enregistrer
              </Button>
            </>
          }
        >
          <DriverForm
            driver={d}
            formId="driver-edit-form"
            onPendingChange={setEditPending}
            onSaved={() => {
              toast.success('Chauffeur mis à jour');
              close();
            }}
          />
        </Modal>
      )}
      {modal === 'account' && <AccountModal driver={d} onClose={close} />}
      {modal === 'assign' && <AssignModal driverId={id} onClose={close} />}
      {modal === 'endAssignment' && d.currentAssignment && d.currentVehicle && (
        <EndAssignmentModal
          assignment={{
            ...d.currentAssignment,
            label: `${fullName(d)} sur ${d.currentVehicle.immatriculation}`,
          }}
          onClose={close}
        />
      )}
      {modal === 'delete' && <DeleteDriver driver={d} onClose={close} />}
    </>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{children}</dd>
    </div>
  );
}

const accountSchema = z.object({
  email: z.email('Adresse email invalide'),
  password: passwordRule,
});
type AccountValues = z.infer<typeof accountSchema>;

/** Création de l'accès mobile ou réinitialisation de ses identifiants. */
function AccountModal({ driver, onClose }: { driver: DriverDetail; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { email: driver.account?.email ?? '', password: '' },
  });
  const save = useMutation({
    mutationFn: (v: AccountValues) =>
      api(`drivers/${driver.id}/account`, { method: 'PUT', body: v }),
    onSuccess: async () => {
      await invalidate(keys.drivers);
      toast.success(driver.account ? 'Identifiants mis à jour' : 'Accès à l’application créé');
      onClose();
    },
    onError: (e) => applyApiErrors(e, setError, ['email', 'password']),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={driver.account ? 'Identifiants de l’application' : 'Créer l’accès à l’application'}
      description="Communiquez ces identifiants au chauffeur : il pourra se connecter à l'application mobile."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="account-form" loading={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="account-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        <FormError error={save.isError && !Object.keys(errors).length ? save.error : null} />
        <Field
          label="Email de connexion"
          htmlFor="acc-email"
          error={errors.email?.message}
          required
        >
          <Input id="acc-email" type="email" autoComplete="off" {...register('email')} />
        </Field>
        <Field
          label={driver.account ? 'Nouveau mot de passe' : 'Mot de passe provisoire'}
          htmlFor="acc-password"
          error={errors.password?.message}
          hint="8 caractères, une lettre et un chiffre"
          required
        >
          <Input
            id="acc-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
      </form>
    </Modal>
  );
}

function DeleteDriver({ driver, onClose }: { driver: DriverDetail; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const remove = useMutation({
    mutationFn: () => api(`drivers/${driver.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(`${fullName(driver)} supprimé`);
      router.replace('/drivers');
      await invalidate(keys.drivers);
    },
  });
  return (
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={() => remove.mutate()}
      loading={remove.isPending}
      title={`Supprimer ${fullName(driver)} ?`}
      message={
        <p>
          La fiche et l&apos;accès à l&apos;application seront supprimés. Un chauffeur qui a déjà un
          historique (affectations, relevés, incidents) ne peut pas être supprimé : passez plutôt
          son statut à <strong>Inactif</strong>.
        </p>
      }
      error={<FormError error={remove.error} />}
    />
  );
}
