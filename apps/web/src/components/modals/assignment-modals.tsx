'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FormError } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { DriverPicker, VehiclePicker } from '@/components/entity-pickers';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { keys } from '@/lib/queries';
import { useInvalidate } from '@/lib/use-invalidate';

/** Date et heure locales pour un champ datetime-local. */
function localInput(date = new Date()): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Nouvelle affectation. Seuls les véhicules disponibles (non hors service, non
 * affectés) et les chauffeurs disponibles (actifs, sans véhicule) sont proposés ;
 * l'API reste juge en dernier ressort (permis, chevauchements).
 */
export function AssignModal({
  onClose,
  vehicleId,
  driverId,
}: {
  onClose: () => void;
  vehicleId?: string;
  driverId?: string;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [vehicle, setVehicle] = useState(vehicleId ?? '');
  const [driver, setDriver] = useState(driverId ?? '');
  const [start, setStart] = useState(localInput());
  const [touched, setTouched] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api('assignments', {
        method: 'POST',
        body: { vehicleId: vehicle, driverId: driver, dateDebut: new Date(start).toISOString() },
      }),
    onSuccess: async () => {
      await invalidate(keys.assignments, keys.vehicles, keys.drivers);
      toast.success('Affectation enregistrée');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Affecter un chauffeur"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={save.isPending}
            onClick={() => {
              setTouched(true);
              if (vehicle && driver && start) save.mutate();
            }}
          >
            Affecter
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        <Field
          label="Véhicule"
          htmlFor="asg-vehicle"
          required
          error={touched && !vehicle ? 'Choisissez un véhicule' : undefined}
          hint={
            !vehicleId ? 'Véhicules disponibles (ni hors service, ni déjà affectés)' : undefined
          }
        >
          <VehiclePicker
            id="asg-vehicle"
            available
            disabled={Boolean(vehicleId)}
            placeholder="Rechercher un véhicule"
            value={vehicle}
            onChange={setVehicle}
            invalid={touched && !vehicle}
          />
        </Field>
        <Field
          label="Chauffeur"
          htmlFor="asg-driver"
          required
          error={touched && !driver ? 'Choisissez un chauffeur' : undefined}
          hint={!driverId ? 'Chauffeurs actifs sans véhicule' : undefined}
        >
          <DriverPicker
            id="asg-driver"
            available
            disabled={Boolean(driverId)}
            placeholder="Rechercher un chauffeur"
            value={driver}
            onChange={setDriver}
            invalid={touched && !driver}
          />
        </Field>
        <Field label="Début" htmlFor="asg-start" required>
          <Input
            id="asg-start"
            type="datetime-local"
            max={localInput()}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Fin de l'affectation en cours. */
export function EndAssignmentModal({
  onClose,
  assignment,
}: {
  onClose: () => void;
  assignment: { id: string; dateDebut: string; label: string };
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [end, setEnd] = useState(localInput());

  const save = useMutation({
    mutationFn: () =>
      api(`assignments/${assignment.id}/end`, {
        method: 'POST',
        body: { dateFin: new Date(end).toISOString() },
      }),
    onSuccess: async () => {
      await invalidate(keys.assignments, keys.vehicles, keys.drivers);
      toast.success('Affectation terminée');
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Terminer l'affectation"
      description={`${assignment.label} · depuis le ${formatDateTime(assignment.dateDebut)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Terminer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={save.error} />
        <Field label="Fin de l'affectation" htmlFor="asg-end" required>
          <Input
            id="asg-end"
            type="datetime-local"
            min={localInput(new Date(assignment.dateDebut))}
            max={localInput()}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
