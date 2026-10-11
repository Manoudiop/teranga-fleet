'use client';

import 'leaflet/dist/leaflet.css';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import Link from 'next/link';
import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { formatDateTime, fullName } from '@/lib/format';
import { ago, freshness } from '@/lib/freshness';
import type { LatestLocation, TrackPoint } from '@/lib/types';

/** Dakar, point de départ de la carte quand aucune position n'est connue. */
const DAKAR: LatLngExpression = [14.7167, -17.4677];

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Recadre la carte sur les points affichés. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1)
      map.fitBounds(points as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 15 });
    // Recadrage seulement quand l'ensemble des points change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function BaseMap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <MapContainer center={DAKAR} zoom={11} scrollWheelZoom className={className ?? 'h-full w-full'}>
      <TileLayer
        attribution={OSM_ATTRIBUTION}
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

/** Dernière position de chaque véhicule. */
export function FleetMap({
  locations,
  selectedId,
  onSelect,
}: {
  locations: LatestLocation[];
  selectedId?: string | null;
  onSelect?: (vehicleId: string) => void;
}) {
  const points = locations.map((l) => [l.latitude, l.longitude] as [number, number]);
  return (
    <BaseMap>
      <FitBounds points={points} />
      {locations.map((l) => {
        const f = freshness(l.recordedAt);
        const selected = l.vehicle.id === selectedId;
        return (
          <CircleMarker
            key={l.vehicle.id}
            center={[l.latitude, l.longitude]}
            radius={selected ? 11 : 8}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: f.color, fillOpacity: 1 }}
            eventHandlers={{ click: () => onSelect?.(l.vehicle.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent={selected}>
              <span className="font-semibold">{l.vehicle.immatriculation}</span>
            </Tooltip>
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">
                  {l.vehicle.immatriculation} · {l.vehicle.marque} {l.vehicle.modele}
                </p>
                <p>{l.driver ? fullName(l.driver) : 'Chauffeur inconnu'}</p>
                <p className="text-slate-500">
                  {f.label} · {ago(l.recordedAt)}
                  {l.speed !== null && ` · ${Math.round(l.speed * 3.6)} km/h`}
                </p>
                <Link href={`/vehicles/${l.vehicle.id}`} className="font-medium text-brand-700">
                  Voir la fiche
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </BaseMap>
  );
}

/** Tracé d'un véhicule sur une période : ligne, départ et dernière position. */
export function TrackMap({ points }: { points: TrackPoint[] }) {
  const line = points.map((p) => [p.latitude, p.longitude] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <BaseMap>
      <FitBounds points={line} />
      <Polyline positions={line} pathOptions={{ color: '#0f7a69', weight: 3, opacity: 0.85 }} />
      {first && (
        <CircleMarker
          center={[first.latitude, first.longitude]}
          radius={6}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#64748b', fillOpacity: 1 }}
        >
          <Tooltip direction="top">Départ · {formatDateTime(first.recordedAt)}</Tooltip>
        </CircleMarker>
      )}
      {last && (
        <CircleMarker
          center={[last.latitude, last.longitude]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0f7a69', fillOpacity: 1 }}
        >
          <Tooltip direction="top" permanent>
            Dernière position · {ago(last.recordedAt)}
          </Tooltip>
        </CircleMarker>
      )}
    </BaseMap>
  );
}
