'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/feedback';

/** Leaflet manipule window et le DOM : cartes chargées uniquement côté navigateur. */
const loading = () => <Spinner label="Chargement de la carte…" />;

export const FleetMap = dynamic(() => import('./fleet-map').then((m) => m.FleetMap), {
  ssr: false,
  loading,
});

export const TrackMap = dynamic(() => import('./fleet-map').then((m) => m.TrackMap), {
  ssr: false,
  loading,
});
