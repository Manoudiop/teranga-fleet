'use client';

import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AccountsTable, NewAccountModal, type Account } from '@/components/accounts';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Button, Card, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { useMe } from '@/lib/queries';

const TEAM_KEY = ['team'] as const;

export default function TeamPage() {
  const me = useMe();
  const [creating, setCreating] = useState(false);
  const team = useQuery({ queryKey: TEAM_KEY, queryFn: () => api<Account[]>('users') });

  return (
    <>
      <PageHeader
        title="Équipe"
        description={
          <>
            Gestionnaires ayant accès au tableau de bord. Les accès des chauffeurs se gèrent depuis
            leur{' '}
            <Link href="/drivers" className="font-medium text-brand-700 hover:text-brand-800">
              fiche chauffeur
            </Link>
            .
          </>
        }
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>
            Ajouter un gestionnaire
          </Button>
        }
      />
      <Card>
        {team.isPending ? (
          <Spinner />
        ) : team.isError ? (
          <ErrorState error={team.error} onRetry={() => void team.refetch()} />
        ) : (
          <AccountsTable
            accounts={team.data}
            currentUserId={me.data?.id}
            basePath="users"
            invalidate={TEAM_KEY}
          />
        )}
      </Card>
      {creating && (
        <NewAccountModal
          endpoint="users"
          title="Ajouter un gestionnaire"
          invalidate={TEAM_KEY}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
