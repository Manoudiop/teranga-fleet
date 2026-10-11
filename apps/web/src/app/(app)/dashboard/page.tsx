'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CircleDollarSign,
  FileWarning,
  Siren,
  Truck,
  Users,
  Wrench,
  AlertOctagon,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { AlertList } from '@/components/alert-list';
import { CostChart } from '@/components/cost-chart';
import { StatCard } from '@/components/stat-card';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatXof } from '@/lib/format';
import { keys, useAlerts } from '@/lib/queries';
import type { DashboardSummary, MaintenanceCosts } from '@/lib/types';

const today = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'Africa/Dakar' });

/** « dimanche 11 octobre 2026 » → « Dimanche 11 octobre 2026 ». */
const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: [...keys.dashboard, 'summary'],
    queryFn: () => api<DashboardSummary>('dashboard/summary'),
  });
  const costs = useQuery({
    queryKey: [...keys.dashboard, 'costs'],
    queryFn: () => api<MaintenanceCosts>('dashboard/maintenance-costs', { query: { months: 6 } }),
  });
  const alerts = useAlerts();

  return (
    <>
      <PageHeader title="Tableau de bord" description={capitalizeFirst(today.format(new Date()))} />

      {summary.isPending ? (
        <Spinner />
      ) : summary.isError ? (
        <Card>
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        </Card>
      ) : (
        <Kpis s={summary.data} />
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Coûts d'entretien"
            description={
              costs.data ? `6 derniers mois · ${formatXof(costs.data.total)}` : 'Six derniers mois'
            }
          />
          <div className="px-5 py-5">
            {costs.isPending ? (
              <Spinner />
            ) : costs.isError ? (
              <ErrorState error={costs.error} onRetry={() => void costs.refetch()} />
            ) : (
              <CostChart data={costs.data} />
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Alertes prioritaires"
            actions={
              <Link
                href="/alerts"
                className="text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Tout voir
              </Link>
            }
          />
          {alerts.isPending ? (
            <Spinner />
          ) : alerts.isError ? (
            <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
          ) : alerts.data.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-6 text-emerald-500" />}
              title="Aucune alerte"
              description="Documents, permis et entretiens sont à jour."
            />
          ) : (
            <AlertList alerts={alerts.data.slice(0, 6)} />
          )}
        </Card>
      </div>
    </>
  );
}

function Kpis({ s }: { s: DashboardSummary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Véhicules actifs"
        value={s.vehicles.active}
        detail={`sur ${s.vehicles.total} véhicule${s.vehicles.total > 1 ? 's' : ''}`}
        icon={Truck}
        href="/vehicles?status=ACTIVE"
      />
      <StatCard
        label="En maintenance"
        value={s.vehicles.maintenance}
        detail={`${s.vehicles.horsService} hors service`}
        icon={AlertOctagon}
        accent={
          s.vehicles.horsService > 0 ? 'danger' : s.vehicles.maintenance > 0 ? 'warning' : 'neutral'
        }
        href="/vehicles?status=MAINTENANCE"
      />
      <StatCard
        label="Documents à renouveler"
        value={s.documents.expired + s.documents.expiringSoon}
        detail={`${s.documents.expired} expiré${s.documents.expired > 1 ? 's' : ''}, ${s.documents.expiringSoon} bientôt`}
        icon={FileWarning}
        accent={
          s.documents.expired > 0 ? 'danger' : s.documents.expiringSoon > 0 ? 'warning' : 'neutral'
        }
        href="/documents?status=EXPIRE"
      />
      <StatCard
        label="Entretiens à prévoir"
        value={s.maintenance.overdue + s.maintenance.dueSoon}
        detail={`${s.maintenance.overdue} dépassé${s.maintenance.overdue > 1 ? 's' : ''}`}
        icon={Wrench}
        accent={
          s.maintenance.overdue > 0 ? 'danger' : s.maintenance.dueSoon > 0 ? 'warning' : 'neutral'
        }
        href="/maintenance"
      />
      <StatCard
        label="Incidents ouverts"
        value={s.incidents.open}
        icon={Siren}
        accent={s.incidents.open > 0 ? 'warning' : 'neutral'}
        detail="à traiter"
        href="/incidents?status=OPEN"
      />
      <StatCard
        label="Chauffeurs actifs"
        value={s.drivers.active}
        detail={
          s.licenses.expired + s.licenses.expiringSoon > 0
            ? `${s.licenses.expired + s.licenses.expiringSoon} permis à renouveler`
            : `sur ${s.drivers.total} chauffeur${s.drivers.total > 1 ? 's' : ''}`
        }
        icon={Users}
        accent={
          s.licenses.expired > 0 ? 'danger' : s.licenses.expiringSoon > 0 ? 'warning' : 'brand'
        }
        href="/drivers"
      />
      <StatCard
        label="Coût du mois"
        value={<span className="text-2xl">{formatXof(s.maintenance.costThisMonth)}</span>}
        detail="entretiens du mois en cours"
        icon={CircleDollarSign}
        href="/maintenance"
      />
      <StatCard
        label="Alertes critiques"
        value={s.alerts.critical}
        detail={`${s.alerts.warning} à surveiller`}
        icon={AlertOctagon}
        accent={s.alerts.critical > 0 ? 'danger' : 'neutral'}
        href="/alerts"
      />
    </div>
  );
}
