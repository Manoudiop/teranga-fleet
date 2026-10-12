'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CircleCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AccountsTable, NewAccountModal, type Account } from '@/components/accounts';
import { ErrorState, FormError, Spinner } from '@/components/ui/feedback';
import { ConfirmModal } from '@/components/ui/modal';
import { Badge, Button, Card, CardHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useMe } from '@/lib/queries';

interface CompanyDetail {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  adresse: string | null;
  suspendedAt: string | null;
  createdAt: string;
  _count: { users: number; vehicles: number; drivers: number; incidents: number };
  users: Account[];
}

/** Administration d'une entreprise cliente : suspension et comptes. */
export default function AdminCompanyPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ['admin', 'company', id] as const;
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);

  const company = useQuery({
    queryKey: key,
    queryFn: () => api<CompanyDetail>(`admin/companies/${id}`),
  });

  const setStatus = useMutation({
    mutationFn: (suspended: boolean) =>
      api(`admin/companies/${id}/status`, { method: 'PATCH', body: { suspended } }),
    onSuccess: async (_data, suspended) => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(suspended ? 'Entreprise suspendue' : 'Entreprise réactivée');
      setConfirming(false);
    },
  });

  if (company.isPending) return <Spinner />;
  if (company.isError) {
    return (
      <Card>
        <ErrorState error={company.error} onRetry={() => void company.refetch()} />
      </Card>
    );
  }
  const c = company.data;
  const suspended = Boolean(c.suspendedAt);

  return (
    <>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" aria-hidden /> Entreprises
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{c.nom}</h1>
            {suspended ? (
              <Badge tone="danger">Suspendue depuis le {formatDate(c.suspendedAt)}</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {c.email}
            {c.telephone && ` · ${c.telephone}`}
            {c.adresse && ` · ${c.adresse}`} · inscrite le {formatDate(c.createdAt)}
          </p>
        </div>
        {suspended ? (
          <Button
            icon={<CircleCheck className="size-4" />}
            loading={setStatus.isPending}
            onClick={() => setStatus.mutate(false)}
          >
            Réactiver l&apos;entreprise
          </Button>
        ) : (
          <Button
            variant="danger"
            icon={<Ban className="size-4" />}
            onClick={() => setConfirming(true)}
          >
            Suspendre l&apos;entreprise
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['Véhicules', c._count.vehicles],
          ['Chauffeurs', c._count.drivers],
          ['Comptes', c._count.users],
          ['Incidents', c._count.incidents],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Comptes"
          description="Gestionnaires et chauffeurs de l'entreprise"
          actions={
            <Button
              size="sm"
              variant="secondary"
              icon={<UserPlus className="size-4" />}
              onClick={() => setCreating(true)}
            >
              Créer un gestionnaire
            </Button>
          }
        />
        <AccountsTable
          accounts={c.users}
          currentUserId={me.data?.id}
          basePath="admin/users"
          invalidate={key}
          showRole
        />
      </Card>

      {confirming && (
        <ConfirmModal
          open
          onClose={() => setConfirming(false)}
          onConfirm={() => setStatus.mutate(true)}
          loading={setStatus.isPending}
          confirmLabel="Suspendre"
          title={`Suspendre ${c.nom} ?`}
          message="Tous les comptes de l'entreprise (gestionnaires et chauffeurs) seront déconnectés et ne pourront plus se connecter. Les données sont conservées et l'entreprise peut être réactivée à tout moment."
          error={<FormError error={setStatus.error} />}
        />
      )}
      {creating && (
        <NewAccountModal
          endpoint={`admin/companies/${id}/managers`}
          title={`Créer un gestionnaire pour ${c.nom}`}
          invalidate={key}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
