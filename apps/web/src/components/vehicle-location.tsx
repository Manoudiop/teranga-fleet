'use client';

import { useQuery } from '@tanstack/react-query';
import { MapPinOff } from 'lucide-react';
import { useState } from 'react';
import { TrackMap } from '@/components/map';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Card, CardHeader, cn } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ago } from '@/lib/freshness';
import { keys } from '@/lib/queries';
import type { Track } from '@/lib/types';

const PERIODS = [
  { hours: 24, label: '24 h' },
  { hours: 72, label: '3 jours' },
  { hours: 168, label: '7 jours' },
];

/** Section « Localisation » de la fiche véhicule : tracé sur la période choisie. */
export function VehicleLocation({ vehicleId }: { vehicleId: string }) {
  const [hours, setHours] = useState(24);
  const track = useQuery({
    queryKey: [...keys.locations, 'track', vehicleId, hours],
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - hours * 3600_000);
      return api<Track>(`vehicles/${vehicleId}/locations`, {
        query: { from: from.toISOString(), to: to.toISOString() },
      });
    },
    refetchInterval: 60_000,
  });

  const last = track.data?.points.at(-1);

  return (
    <Card>
      <CardHeader
        title="Localisation"
        description={
          last
            ? `Dernière position ${ago(last.recordedAt)} · ${formatDateTime(last.recordedAt)}`
            : 'Positions envoyées par le chauffeur en service'
        }
        actions={
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <button
                key={p.hours}
                type="button"
                aria-pressed={hours === p.hours}
                onClick={() => setHours(p.hours)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  hours === p.hours
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      {track.isPending ? (
        <Spinner />
      ) : track.isError ? (
        <ErrorState error={track.error} onRetry={() => void track.refetch()} />
      ) : track.data.points.length === 0 ? (
        <EmptyState
          icon={<MapPinOff className="size-6" />}
          title="Aucune position sur cette période"
          description="Le véhicule est localisé quand son chauffeur passe « En service » dans l'application mobile."
        />
      ) : (
        <>
          <div className="h-80">
            <TrackMap points={track.data.points} />
          </div>
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            {track.data.points.length} position(s)
            {track.data.truncated &&
              ' · période trop chargée : seules les positions les plus récentes sont affichées'}
          </p>
        </>
      )}
    </Card>
  );
}
