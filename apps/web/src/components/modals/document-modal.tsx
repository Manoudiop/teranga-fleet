'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormError } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { toDateInput } from '@/lib/format';
import { applyApiErrors } from '@/lib/forms';
import { DOCUMENT_TYPE, options } from '@/lib/labels';
import { keys, useVehicleOptions } from '@/lib/queries';
import type { FleetDocument } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

const MAX_MB = 10;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

const schema = z
  .object({
    vehicleId: z.string().min(1, 'Choisissez un véhicule'),
    type: z.enum(['CARTE_GRISE', 'ASSURANCE', 'VISITE_TECHNIQUE', 'VIGNETTE']),
    dateEmission: z.string(),
    dateExpiration: z.string().min(1, "La date d'expiration est obligatoire"),
    fichier: z
      .custom<FileList>()
      .optional()
      .refine(
        (files) => !files?.[0] || files[0].size <= MAX_MB * 1024 * 1024,
        `Fichier limité à ${MAX_MB} Mo`,
      )
      .refine(
        (files) => !files?.[0] || /\.(pdf|jpe?g|png)$/i.test(files[0].name),
        'Formats acceptés : PDF, JPG, PNG',
      ),
  })
  .refine((v) => !v.dateEmission || v.dateExpiration >= v.dateEmission, {
    path: ['dateExpiration'],
    message: "L'expiration doit suivre l'émission",
  });
type Values = z.infer<typeof schema>;

/**
 * Ajout ou modification d'un document, avec fichier optionnel. À monter
 * uniquement quand la fenêtre est ouverte (formulaire neuf à chaque ouverture). Le type réel
 * du fichier est vérifié par l'API (signature binaire), le contrôle ici sert
 * seulement à prévenir l'utilisateur au plus tôt.
 */
export function DocumentModal({
  onClose,
  vehicleId,
  document,
}: {
  onClose: () => void;
  /** Véhicule imposé (fiche véhicule) ; sinon un sélecteur est affiché. */
  vehicleId?: string;
  document?: FleetDocument;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const vehicles = useVehicleOptions();
  const isEdit = Boolean(document);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: document?.vehicleId ?? vehicleId ?? '',
      type: document?.type ?? 'ASSURANCE',
      dateEmission: toDateInput(document?.dateEmission),
      dateExpiration: toDateInput(document?.dateExpiration),
    },
  });

  const save = useMutation({
    mutationFn: (v: Values) => {
      const form = new FormData();
      form.set('type', v.type);
      if (v.dateEmission) form.set('dateEmission', v.dateEmission);
      form.set('dateExpiration', v.dateExpiration);
      const file = v.fichier?.[0];
      if (file) form.set('fichier', file);
      return isEdit
        ? api<FleetDocument>(`documents/${document!.id}`, { method: 'PATCH', body: form })
        : api<FleetDocument>(`vehicles/${v.vehicleId}/documents`, { method: 'POST', body: form });
    },
    onSuccess: async () => {
      await invalidate(keys.documents, keys.vehicles);
      toast.success(isEdit ? 'Document mis à jour' : 'Document ajouté');
      onClose();
    },
    onError: (error) => applyApiErrors(error, setError, ['type', 'dateEmission', 'dateExpiration']),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier le document' : 'Ajouter un document'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="document-form" loading={save.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="document-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        <FormError error={save.isError && !Object.keys(errors).length ? save.error : null} />
        {!vehicleId && !isEdit && (
          <Field label="Véhicule" htmlFor="doc-vehicle" error={errors.vehicleId?.message} required>
            <Select
              id="doc-vehicle"
              placeholder="Choisir un véhicule"
              options={(vehicles.data ?? []).map((v) => ({
                value: v.id,
                label: `${v.immatriculation} · ${v.marque} ${v.modele}`,
              }))}
              {...register('vehicleId')}
            />
          </Field>
        )}
        <Field label="Type de document" htmlFor="doc-type" error={errors.type?.message} required>
          <Select id="doc-type" options={options(DOCUMENT_TYPE)} {...register('type')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date d'émission"
            htmlFor="doc-emission"
            error={errors.dateEmission?.message}
          >
            <Input id="doc-emission" type="date" {...register('dateEmission')} />
          </Field>
          <Field
            label="Date d'expiration"
            htmlFor="doc-expiration"
            error={errors.dateExpiration?.message}
            required
          >
            <Input id="doc-expiration" type="date" {...register('dateExpiration')} />
          </Field>
        </div>
        <Field
          label={isEdit && document?.hasFile ? 'Remplacer le fichier' : 'Fichier'}
          htmlFor="doc-file"
          error={errors.fichier?.message}
          hint={`PDF, JPG ou PNG, ${MAX_MB} Mo maximum`}
        >
          <input
            id="doc-file"
            type="file"
            accept={ACCEPT}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            {...register('fichier')}
          />
        </Field>
      </form>
    </Modal>
  );
}
