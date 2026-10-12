'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorState, FormError, Spinner } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Select, StatusBadge, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { VehiclePicker } from '@/components/entity-pickers';
import { api, apiPath } from '@/lib/api';
import { formatDateTime, fullName } from '@/lib/format';
import { INCIDENT_SEVERITY, INCIDENT_STATUS, INCIDENT_TYPE, options } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { Incident } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

/** Détail et traitement d'un incident par le gestionnaire. À monter à l'ouverture. */
export function IncidentModal({
  incidentId,
  onClose,
}: {
  incidentId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const incident = useQuery({
    queryKey: [...keys.incidents, 'detail', incidentId],
    queryFn: () => api<Incident>(`incidents/${incidentId}`),
  });
  const [draft, setDraft] = useState<{ status?: string; severity?: string; notes?: string }>({});

  const save = useMutation({
    mutationFn: () =>
      api<Incident>(`incidents/${incidentId}`, {
        method: 'PATCH',
        body: {
          status: draft.status,
          severity: draft.severity,
          notesGestionnaire: draft.notes,
        },
      }),
    onSuccess: async () => {
      await invalidate(keys.incidents, keys.vehicles);
      toast.success('Incident mis à jour');
      onClose();
    },
  });

  const data = incident.data;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Incident"
      description={
        data
          ? `${INCIDENT_TYPE[data.type]} · ${data.vehicle.immatriculation} · ${formatDateTime(data.createdAt)}`
          : undefined
      }
      footer={
        data && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            <Button
              loading={save.isPending}
              disabled={!Object.keys(draft).length}
              onClick={() => save.mutate()}
            >
              Enregistrer
            </Button>
          </>
        )
      }
    >
      {incident.isPending ? (
        <Spinner />
      ) : incident.isError ? (
        <ErrorState error={incident.error} onRetry={() => void incident.refetch()} />
      ) : (
        <div className="space-y-5">
          <FormError error={save.error} />
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={INCIDENT_STATUS[data!.status]} />
            <StatusBadge value={INCIDENT_SEVERITY[data!.severity]} />
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Signalé par</dt>
              <dd className="font-medium text-slate-900">
                {data!.driver ? fullName(data!.driver) : 'Gestionnaire'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Véhicule</dt>
              <dd className="font-medium text-slate-900">
                {data!.vehicle.immatriculation} · {data!.vehicle.marque} {data!.vehicle.modele}
              </dd>
            </div>
            {data!.resolvedAt && (
              <div>
                <dt className="text-slate-500">Résolu le</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(data!.resolvedAt)}</dd>
              </div>
            )}
          </dl>
          <div>
            <p className="text-sm text-slate-500">Description</p>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-900">{data!.description}</p>
          </div>
          {data!.hasPhoto && (
            <a
              href={apiPath(`incidents/${data!.id}/photo`)}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {/* Photo servie par le relais authentifié : pas d'optimisation next/image possible. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={apiPath(`incidents/${data!.id}/photo`)}
                alt="Photo de l'incident"
                className="max-h-72 rounded-lg object-contain ring-1 ring-slate-200"
              />
            </a>
          )}
          <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <Field label="Statut" htmlFor="inc-status">
              <Select
                id="inc-status"
                options={options(INCIDENT_STATUS)}
                defaultValue={data!.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
              />
            </Field>
            <Field label="Gravité" htmlFor="inc-severity">
              <Select
                id="inc-severity"
                options={options(INCIDENT_SEVERITY)}
                defaultValue={data!.severity}
                onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}
              />
            </Field>
            <Field
              label="Notes de suivi"
              htmlFor="inc-notes"
              className="sm:col-span-2"
              hint="Diagnostic, garage, suite donnée…"
            >
              <Textarea
                id="inc-notes"
                rows={3}
                defaultValue={data!.notesGestionnaire ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Déclaration d'un incident par le gestionnaire. À monter à l'ouverture. */
export function NewIncidentModal({
  onClose,
  vehicleId,
}: {
  onClose: () => void;
  vehicleId?: string;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [vehicle, setVehicle] = useState(vehicleId ?? '');
  const [type, setType] = useState('PANNE');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('vehicleId', vehicle);
      form.set('type', type);
      form.set('severity', severity);
      form.set('description', description.trim());
      if (photo) form.set('photo', photo);
      return api('incidents', { method: 'POST', body: form });
    },
    onSuccess: async () => {
      await invalidate(keys.incidents, keys.vehicles);
      toast.success('Incident déclaré');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Déclarer un incident"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              setTouched(true);
              if (vehicle && description.trim()) save.mutate();
            }}
          >
            Déclarer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        {!vehicleId && (
          <Field
            label="Véhicule"
            htmlFor="new-inc-vehicle"
            required
            error={touched && !vehicle ? 'Choisissez un véhicule' : undefined}
          >
            <VehiclePicker
              id="new-inc-vehicle"
              placeholder="Rechercher un véhicule"
              value={vehicle}
              onChange={setVehicle}
              invalid={touched && !vehicle}
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="new-inc-type" required>
            <Select
              id="new-inc-type"
              options={options(INCIDENT_TYPE)}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </Field>
          <Field label="Gravité" htmlFor="new-inc-severity" required>
            <Select
              id="new-inc-severity"
              options={options(INCIDENT_SEVERITY)}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Description"
          htmlFor="new-inc-desc"
          required
          error={touched && !description.trim() ? 'Décrivez l’incident' : undefined}
        >
          <Textarea
            id="new-inc-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </Field>
        <Field label="Photo" htmlFor="new-inc-photo" hint="JPG ou PNG">
          <input
            id="new-inc-photo"
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
          />
        </Field>
      </div>
    </Modal>
  );
}
