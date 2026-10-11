'use client';

import type { AlertSeverity } from '@teranga-fleet/shared';
import { CheckCircle2 } from 'lucide-react';
import { AlertList } from '@/components/alert-list';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Card, CardHeader, PageHeader, cn } from '@/components/ui/primitives';
import { ALERT_SEVERITY } from '@/lib/labels';
import { useAlerts } from '@/lib/queries';
import { useUrlState } from '@/lib/use-url-state';

const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];

const SECTION_TITLES: Record<AlertSeverity, string> = {
  CRITICAL: 'Critiques',
  WARNING: 'À surveiller',
  INFO: 'Pour information',
};

export default function AlertsPage() {
  const alerts = useAlerts();
  const { values, set } = useUrlState(['severity'] as const);
  const selected = values.severity as AlertSeverity | '';

  const counts = Object.fromEntries(
    SEVERITIES.map((s) => [s, alerts.data?.filter((a) => a.severity === s).length ?? 0]),
  ) as Record<AlertSeverity, number>;

  return (
    <>
      <PageHeader
        title="Alertes"
        description="Documents, permis, entretiens, véhicules indisponibles et incidents graves."
      />

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrer par gravité">
        <FilterChip active={!selected} onClick={() => set({ severity: undefined })}>
          Toutes ({alerts.data?.length ?? 0})
        </FilterChip>
        {SEVERITIES.map((s) => (
          <FilterChip key={s} active={selected === s} onClick={() => set({ severity: s })}>
            {ALERT_SEVERITY[s].label} ({counts[s]})
          </FilterChip>
        ))}
      </div>

      {alerts.isPending ? (
        <Spinner />
      ) : alerts.isError ? (
        <Card>
          <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
        </Card>
      ) : alerts.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="size-6 text-emerald-500" />}
            title="Aucune alerte"
            description="Documents, permis et entretiens de la flotte sont à jour."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {SEVERITIES.filter((s) => (!selected || selected === s) && counts[s] > 0).map((s) => (
            <Card key={s}>
              <CardHeader title={`${SECTION_TITLES[s]} (${counts[s]})`} />
              <AlertList alerts={alerts.data.filter((a) => a.severity === s)} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors',
        active
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}
