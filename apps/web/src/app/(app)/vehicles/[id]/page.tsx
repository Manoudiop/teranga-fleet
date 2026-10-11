'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Gauge,
  Pencil,
  Plus,
  Siren,
  Trash2,
  UserPlus,
  UserX,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AssignModal, EndAssignmentModal } from '@/components/modals/assignment-modals';
import { DocumentModal } from '@/components/modals/document-modal';
import { IncidentModal, NewIncidentModal } from '@/components/modals/incident-modals';
import { MaintenanceModal } from '@/components/modals/maintenance-modal';
import { MileageModal } from '@/components/modals/mileage-modal';
import { EmptyState, ErrorState, FormError, Spinner } from '@/components/ui/feedback';
import { VehicleLocation } from '@/components/vehicle-location';
import { ConfirmModal } from '@/components/ui/modal';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  StatusBadge,
  Table,
  Td,
  Th,
  buttonClass,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api, apiPath } from '@/lib/api';
import { formatDate, formatDateTime, formatKm, formatXof, fullName } from '@/lib/format';
import {
  DOCUMENT_TYPE,
  EXPIRY_STATUS,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_TYPE,
  MILEAGE_SOURCE,
  VEHICLE_STATUS,
} from '@/lib/labels';
import { keys } from '@/lib/queries';
import type {
  FleetDocument,
  Incident,
  MaintenanceDue,
  MaintenanceRecord,
  MileageLog,
  VehicleDetail,
} from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';

type ModalState =
  | { kind: 'document'; document?: FleetDocument }
  | { kind: 'deleteDocument'; document: FleetDocument }
  | { kind: 'maintenance'; record?: MaintenanceRecord }
  | { kind: 'mileage' }
  | { kind: 'assign' }
  | { kind: 'endAssignment' }
  | { kind: 'incident'; id: string }
  | { kind: 'newIncident' }
  | { kind: 'deleteVehicle' };

export default function VehiclePage() {
  const { id } = useParams<{ id: string }>();
  const [modal, setModal] = useState<ModalState | null>(null);
  const close = () => setModal(null);

  const vehicle = useQuery({
    queryKey: [...keys.vehicles, 'detail', id],
    queryFn: () => api<VehicleDetail>(`vehicles/${id}`),
  });

  if (vehicle.isPending) return <Spinner />;
  if (vehicle.isError) {
    return (
      <Card>
        <ErrorState error={vehicle.error} onRetry={() => void vehicle.refetch()} />
      </Card>
    );
  }
  const v = vehicle.data;

  return (
    <>
      <Link
        href="/vehicles"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" aria-hidden /> Véhicules
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {v.immatriculation}
            </h1>
            <StatusBadge value={VEHICLE_STATUS[v.statut]} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {v.marque} {v.modele}
            {v.type && ` · ${v.type}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<Gauge className="size-4" />}
            onClick={() => setModal({ kind: 'mileage' })}
          >
            Relevé
          </Button>
          <Link href={`/vehicles/${id}/edit`} className={buttonClass('secondary')}>
            <Pencil className="size-4" aria-hidden /> Modifier
          </Link>
          <Button
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            onClick={() => setModal({ kind: 'deleteVehicle' })}
            aria-label="Supprimer le véhicule"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Informations générales" />
          <dl className="grid gap-x-6 gap-y-4 px-5 py-5 text-sm sm:grid-cols-3">
            <Info label="Immatriculation">{v.immatriculation}</Info>
            <Info label="Marque">{v.marque}</Info>
            <Info label="Modèle">{v.modele}</Info>
            <Info label="Année">{v.annee ?? '—'}</Info>
            <Info label="Type">{v.type ?? '—'}</Info>
            <Info label="Acquisition">{formatDate(v.dateAcquisition)}</Info>
            <Info label="Kilométrage">
              <span className="text-base font-semibold tabular-nums">
                {formatKm(v.kilometrageActuel)}
              </span>
            </Info>
            <Info label="Statut">
              <StatusBadge value={VEHICLE_STATUS[v.statut]} />
            </Info>
            <Info label="Incidents en cours">{v.counts.openIncidents}</Info>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Chauffeur actuel" />
          <div className="px-5 py-5">
            {v.currentDriver ? (
              <div className="space-y-4">
                <div>
                  <Link
                    href={`/drivers/${v.currentDriver.id}`}
                    className="text-base font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {fullName(v.currentDriver)}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {v.currentDriver.contact ?? 'Pas de contact'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Depuis le {formatDateTime(v.currentAssignment!.dateDebut)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<UserX className="size-4" />}
                  onClick={() => setModal({ kind: 'endAssignment' })}
                >
                  Terminer l&apos;affectation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Aucun chauffeur n&apos;est affecté à ce véhicule.
                </p>
                {v.statut === 'HORS_SERVICE' ? (
                  <p className="text-sm text-amber-700">
                    Un véhicule hors service ne peut pas être affecté.
                  </p>
                ) : (
                  <Button
                    size="sm"
                    icon={<UserPlus className="size-4" />}
                    onClick={() => setModal({ kind: 'assign' })}
                  >
                    Affecter un chauffeur
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        <VehicleLocation vehicleId={id} />
        <DocumentsSection
          vehicleId={id}
          onAdd={() => setModal({ kind: 'document' })}
          onEdit={(d) => setModal({ kind: 'document', document: d })}
          onDelete={(d) => setModal({ kind: 'deleteDocument', document: d })}
        />
        <MaintenanceSection
          vehicleId={id}
          onAdd={() => setModal({ kind: 'maintenance' })}
          onEdit={(r) => setModal({ kind: 'maintenance', record: r })}
        />
        <MileageSection vehicleId={id} onAdd={() => setModal({ kind: 'mileage' })} />
        <IncidentsSection
          vehicleId={id}
          onAdd={() => setModal({ kind: 'newIncident' })}
          onOpen={(incidentId) => setModal({ kind: 'incident', id: incidentId })}
        />
      </div>

      {modal?.kind === 'document' && (
        <DocumentModal vehicleId={id} document={modal.document} onClose={close} />
      )}
      {modal?.kind === 'deleteDocument' && (
        <DeleteDocument document={modal.document} onClose={close} />
      )}
      {modal?.kind === 'maintenance' && (
        <MaintenanceModal
          vehicleId={id}
          record={modal.record}
          currentKm={v.kilometrageActuel}
          onClose={close}
        />
      )}
      {modal?.kind === 'mileage' && <MileageModal vehicle={v} onClose={close} />}
      {modal?.kind === 'assign' && <AssignModal vehicleId={id} onClose={close} />}
      {modal?.kind === 'endAssignment' && v.currentAssignment && (
        <EndAssignmentModal
          assignment={{
            ...v.currentAssignment,
            label: `${fullName(v.currentDriver)} sur ${v.immatriculation}`,
          }}
          onClose={close}
        />
      )}
      {modal?.kind === 'incident' && <IncidentModal incidentId={modal.id} onClose={close} />}
      {modal?.kind === 'newIncident' && <NewIncidentModal vehicleId={id} onClose={close} />}
      {modal?.kind === 'deleteVehicle' && <DeleteVehicle vehicle={v} onClose={close} />}
    </>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- Sections */

function DocumentsSection({
  vehicleId,
  onAdd,
  onEdit,
  onDelete,
}: {
  vehicleId: string;
  onAdd: () => void;
  onEdit: (d: FleetDocument) => void;
  onDelete: (d: FleetDocument) => void;
}) {
  const documents = useQuery({
    queryKey: [...keys.documents, 'vehicle', vehicleId],
    queryFn: () => api<FleetDocument[]>(`vehicles/${vehicleId}/documents`),
  });
  return (
    <Card>
      <CardHeader
        title="Documents"
        description="Carte grise, assurance, visite technique, vignette"
        actions={
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={onAdd}>
            Ajouter
          </Button>
        }
      />
      {documents.isPending ? (
        <Spinner />
      ) : documents.isError ? (
        <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
      ) : documents.data.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="Aucun document"
          description="Ajoutez l'assurance, la visite technique et la vignette pour être alerté avant leur expiration."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Type</Th>
              <Th>Émission</Th>
              <Th>Expiration</Th>
              <Th>Statut</Th>
              <Th>Fichier</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.data.map((d) => (
              <tr key={d.id}>
                <Td className="font-medium text-slate-900">{DOCUMENT_TYPE[d.type]}</Td>
                <Td>{formatDate(d.dateEmission)}</Td>
                <Td>{formatDate(d.dateExpiration)}</Td>
                <Td>
                  <StatusBadge value={EXPIRY_STATUS[d.status]} />
                </Td>
                <Td>
                  {d.hasFile ? (
                    <a
                      href={apiPath(`documents/${d.id}/file`)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-700 hover:text-brand-800"
                    >
                      Ouvrir ({d.fileType?.toUpperCase()})
                    </a>
                  ) : (
                    <span className="text-slate-400">Aucun</span>
                  )}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(d)}
                    aria-label={`Modifier ${DOCUMENT_TYPE[d.type]}`}
                    icon={<Pencil className="size-4" />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(d)}
                    aria-label={`Supprimer ${DOCUMENT_TYPE[d.type]}`}
                    icon={<Trash2 className="size-4" />}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function MaintenanceSection({
  vehicleId,
  onAdd,
  onEdit,
}: {
  vehicleId: string;
  onAdd: () => void;
  onEdit: (r: MaintenanceRecord) => void;
}) {
  const history = useQuery({
    queryKey: [...keys.maintenance, 'vehicle', vehicleId],
    queryFn: () =>
      api<PaginatedResponse<MaintenanceRecord> & { totalCout: number }>('maintenance', {
        query: { vehicleId, limit: 10 },
      }),
  });
  const due = useQuery({
    queryKey: [...keys.maintenance, 'due', vehicleId],
    queryFn: () => api<MaintenanceDue[]>('maintenance/due', { query: { vehicleId } }),
  });

  return (
    <Card>
      <CardHeader
        title="Maintenance"
        description={
          history.data
            ? `${history.data.meta.total} entretien(s) · ${formatXof(history.data.totalCout)} au total`
            : undefined
        }
        actions={
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={onAdd}>
            Ajouter
          </Button>
        }
      />
      {due.data && due.data.length > 0 && (
        <ul className="space-y-2 border-b border-slate-100 px-5 py-4">
          {due.data.map((d) => (
            <li key={d.maintenanceId} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={d.level === 'OVERDUE' ? 'danger' : 'warning'}>
                {d.level === 'OVERDUE' ? 'Dépassé' : 'À prévoir'}
              </Badge>
              <span className="font-medium text-slate-900">{d.type}</span>
              <span className="text-slate-500">
                {[d.km && `à ${formatKm(d.km.due)}`, d.date && `le ${formatDate(d.date.due)}`]
                  .filter(Boolean)
                  .join(' ou ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {history.isPending ? (
        <Spinner />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.data.length === 0 ? (
        <EmptyState icon={<Wrench className="size-6" />} title="Aucun entretien enregistré" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Intervention</Th>
                <Th className="text-right">Kilométrage</Th>
                <Th className="text-right">Coût</Th>
                <Th>Garage</Th>
                <Th>Prochain entretien</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.data.data.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{formatDate(r.date)}</Td>
                  <Td className="font-medium text-slate-900">{r.type}</Td>
                  <Td className="text-right tabular-nums">{formatKm(r.kilometrageAuMoment)}</Td>
                  <Td className="text-right whitespace-nowrap tabular-nums">{formatXof(r.cout)}</Td>
                  <Td>{r.garage ?? '—'}</Td>
                  <Td className="text-slate-500">
                    {[
                      r.prochainEntretienKm && formatKm(r.prochainEntretienKm),
                      r.prochainEntretienDate && formatDate(r.prochainEntretienDate),
                    ]
                      .filter(Boolean)
                      .join(' / ') || '—'}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(r)}
                      aria-label="Modifier l'entretien"
                      icon={<Pencil className="size-4" />}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {history.data.meta.total > 10 && (
            <div className="border-t border-slate-100 px-5 py-3 text-sm">
              <Link
                href={`/maintenance?vehicleId=${vehicleId}`}
                className="font-medium text-brand-700 hover:text-brand-800"
              >
                Voir tout l&apos;historique
              </Link>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function MileageSection({ vehicleId, onAdd }: { vehicleId: string; onAdd: () => void }) {
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: [...keys.mileage, 'vehicle', vehicleId, page],
    queryFn: () =>
      api<PaginatedResponse<MileageLog>>(`vehicles/${vehicleId}/mileage`, {
        query: { page, limit: 8 },
      }),
  });
  return (
    <Card>
      <CardHeader
        title="Kilométrage"
        description="Relevés saisis par les chauffeurs ou par le gestionnaire"
        actions={
          <Button size="sm" variant="secondary" icon={<Gauge className="size-4" />} onClick={onAdd}>
            Saisir un relevé
          </Button>
        }
      />
      {logs.isPending ? (
        <Spinner />
      ) : logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
      ) : logs.data.data.length === 0 ? (
        <EmptyState icon={<Gauge className="size-6" />} title="Aucun relevé" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th className="text-right">Kilométrage</Th>
                <Th>Source</Th>
                <Th>Chauffeur</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.data.data.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(l.date)}</Td>
                  <Td className="text-right font-medium text-slate-900 tabular-nums">
                    {formatKm(l.kilometrage)}
                  </Td>
                  <Td>{MILEAGE_SOURCE[l.source]}</Td>
                  <Td>{l.driver ? fullName(l.driver) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {logs.data.meta.totalPages > 1 && (
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Plus récents
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= logs.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Plus anciens
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function IncidentsSection({
  vehicleId,
  onAdd,
  onOpen,
}: {
  vehicleId: string;
  onAdd: () => void;
  onOpen: (id: string) => void;
}) {
  const incidents = useQuery({
    queryKey: [...keys.incidents, 'vehicle', vehicleId],
    queryFn: () =>
      api<PaginatedResponse<Incident>>('incidents', { query: { vehicleId, limit: 10 } }),
  });
  return (
    <Card>
      <CardHeader
        title="Incidents"
        actions={
          <Button size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={onAdd}>
            Déclarer
          </Button>
        }
      />
      {incidents.isPending ? (
        <Spinner />
      ) : incidents.isError ? (
        <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
      ) : incidents.data.data.length === 0 ? (
        <EmptyState icon={<Siren className="size-6" />} title="Aucun incident signalé" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {incidents.data.data.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => onOpen(i.id)}
                className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
              >
                <StatusBadge value={INCIDENT_STATUS[i.status]} />
                <span className="font-medium text-slate-900">{INCIDENT_TYPE[i.type]}</span>
                <StatusBadge value={INCIDENT_SEVERITY[i.severity]} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                  {i.description}
                </span>
                <span className="text-sm text-slate-500">{formatDate(i.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ Suppressions */

function DeleteDocument({ document, onClose }: { document: FleetDocument; onClose: () => void }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const remove = useMutation({
    mutationFn: () => api(`documents/${document.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidate(keys.documents, keys.vehicles);
      toast.success('Document supprimé');
      onClose();
    },
  });
  return (
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={() => remove.mutate()}
      loading={remove.isPending}
      title="Supprimer le document"
      message={`${DOCUMENT_TYPE[document.type]} expirant le ${formatDate(document.dateExpiration)} sera supprimé, ainsi que son fichier.`}
      error={<FormError error={remove.error} />}
    />
  );
}

function DeleteVehicle({ vehicle, onClose }: { vehicle: VehicleDetail; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const remove = useMutation({
    mutationFn: () => api(`vehicles/${vehicle.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(`Véhicule ${vehicle.immatriculation} supprimé`);
      router.replace('/vehicles');
      await invalidate(
        keys.vehicles,
        keys.documents,
        keys.maintenance,
        keys.assignments,
        keys.incidents,
      );
    },
  });
  return (
    <ConfirmModal
      open
      onClose={onClose}
      onConfirm={() => remove.mutate()}
      loading={remove.isPending}
      title={`Supprimer ${vehicle.immatriculation} ?`}
      message={
        <p>
          Le véhicule et <strong>tout son historique</strong> seront définitivement supprimés :{' '}
          {vehicle.counts.documents} document(s), {vehicle.counts.maintenanceRecords} entretien(s),{' '}
          {vehicle.counts.mileageLogs} relevé(s), affectations et incidents. Pour un véhicule vendu
          ou réformé, préférez le statut « Hors service ».
        </p>
      }
      error={<FormError error={remove.error} />}
    />
  );
}
