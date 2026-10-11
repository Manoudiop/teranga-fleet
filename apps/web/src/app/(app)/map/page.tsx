'use client';

import { useQuery } from '@tanstack/react-query';
import { MapPinOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FleetMap } from '@/components/map';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Card, CardHeader, PageHeader, cn } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { fullName } from '@/lib/format';
import { ago, freshness } from '@/lib/freshness';
import { keys } from '@/lib/queries';
import type { LatestLocation } from '@/lib/types';

const LEGEND = [
  { color: '#0f7a69', label: 'Moins de 15 min' },
  { color: '#d97706', label: 'Moins de 2 h' },
  { color: '#94a3b8', label: 'Plus ancienne' },
];

export default function MapPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const locations = useQuery({
    queryKey: [...keys.locations, 'latest'],
    queryFn: () => api<LatestLocation[]>('locations/latest'),
    // Les chauffeurs en service envoient une position environ chaque minute.
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title="Carte de la flotte"
        description="Dernière position connue des véhicules dont le chauffeur est en service (7 derniers jours)."
      />

      {locations.isPending ? (
        <Spinner />
      ) : locations.isError ? (
        <Card>
          <ErrorState error={locations.error} onRetry={() => void locations.refetch()} />
        </Card>
      ) : locations.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MapPinOff className="size-6" />}
            title="Aucune position récente"
            description="Les véhicules apparaissent ici quand leur chauffeur passe « En service » dans l'application mobile."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="overflow-hidden lg:col-span-2">
            <div className="h-[420px] lg:h-[600px]">
              <FleetMap locations={locations.data} selectedId={selected} onSelect={setSelected} />
            </div>
            <ul
              className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"
              aria-label="Légende"
            >
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: l.color }}
                    aria-hidden
                  />
                  {l.label}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={`Véhicules localisés (${locations.data.length})`} />
            <ul className="divide-y divide-slate-100">
              {locations.data.map((l) => {
                const f = freshness(l.recordedAt);
                return (
                  <li
                    key={l.vehicle.id}
                    className={cn(
                      'flex items-start gap-3 px-5 py-3',
                      selected === l.vehicle.id && 'bg-brand-50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(l.vehicle.id)}
                      aria-pressed={selected === l.vehicle.id}
                      aria-label={`Afficher ${l.vehicle.immatriculation} sur la carte`}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className="mt-1.5 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: f.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-900">
                          {l.vehicle.immatriculation}
                        </span>
                        <span className="block text-sm text-slate-500">
                          {l.driver ? fullName(l.driver) : '—'} · {ago(l.recordedAt)}
                          {l.speed !== null &&
                            l.speed > 1 &&
                            ` · ${Math.round(l.speed * 3.6)} km/h`}
                        </span>
                      </span>
                    </button>
                    <Link
                      href={`/vehicles/${l.vehicle.id}`}
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      Fiche
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
