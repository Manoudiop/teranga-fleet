import type { Alert, AlertType } from '@teranga-fleet/shared';
import {
  AlertOctagon,
  CalendarClock,
  ChevronRight,
  FileWarning,
  IdCard,
  Info,
  Siren,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { ALERT_SEVERITY } from '@/lib/labels';
import { StatusBadge, cn } from './ui/primitives';

const ICONS: Record<AlertType, LucideIcon> = {
  DOCUMENT_EXPIRED: FileWarning,
  DOCUMENT_EXPIRING: CalendarClock,
  LICENSE_EXPIRED: IdCard,
  LICENSE_EXPIRING: IdCard,
  MAINTENANCE_OVERDUE: Wrench,
  MAINTENANCE_DUE: Wrench,
  VEHICLE_OUT_OF_SERVICE: AlertOctagon,
  VEHICLE_IN_MAINTENANCE: Info,
  INCIDENT_OPEN: Siren,
};

const ICON_TONE = {
  CRITICAL: 'bg-red-50 text-red-600',
  WARNING: 'bg-amber-50 text-amber-600',
  INFO: 'bg-sky-50 text-sky-600',
};

/** Page de l'application qui permet d'agir sur l'alerte. */
export function alertHref(alert: Alert): string {
  if (alert.type.startsWith('LICENSE') && alert.driverId) return `/drivers/${alert.driverId}`;
  if (alert.type === 'INCIDENT_OPEN') return `/incidents?focus=${alert.incidentId}`;
  if (alert.vehicleId) return `/vehicles/${alert.vehicleId}`;
  return '/alerts';
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {alerts.map((alert) => {
        const Icon = ICONS[alert.type] ?? TriangleAlert;
        return (
          <li key={alert.id}>
            <Link
              href={alertHref(alert)}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50"
            >
              <span className={cn('mt-0.5 rounded-lg p-1.5', ICON_TONE[alert.severity])}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{alert.title}</span>
                  <StatusBadge value={ALERT_SEVERITY[alert.severity]} />
                </span>
                <span className="mt-0.5 block text-sm text-slate-500">{alert.message}</span>
              </span>
              <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
