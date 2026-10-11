'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DocumentModal } from '@/components/modals/document-modal';
import {
  EmptyState,
  ErrorState,
  FormError,
  Pagination,
  Spinner,
  Toolbar,
} from '@/components/ui/feedback';
import { ConfirmModal } from '@/components/ui/modal';
import {
  Button,
  Card,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/search-input';
import { useToast } from '@/components/ui/toast';
import { api, apiPath } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { DOCUMENT_TYPE, EXPIRY_STATUS, options } from '@/lib/labels';
import { keys } from '@/lib/queries';
import type { FleetDocument } from '@/lib/types';
import { useInvalidate } from '@/lib/use-invalidate';
import { useUrlState } from '@/lib/use-url-state';

export default function DocumentsPage() {
  const toast = useToast();
  const invalidate = useInvalidate();
  const { values, page, set } = useUrlState(['search', 'type', 'status'] as const);
  const query = { ...values, page, limit: 20 };
  const [editing, setEditing] = useState<FleetDocument | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FleetDocument | null>(null);

  const documents = useQuery({
    queryKey: [...keys.documents, 'list', query],
    queryFn: () => api<PaginatedResponse<FleetDocument>>('documents', { query }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (d: FleetDocument) => api(`documents/${d.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidate(keys.documents, keys.vehicles);
      toast.success('Document supprimé');
      setDeleting(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Documents"
        description="Échéances de la flotte, de la plus proche à la plus lointaine."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Ajouter un document
          </Button>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput
            label="Rechercher par immatriculation"
            placeholder="Immatriculation…"
            value={values.search}
            onChange={(search) => set({ search })}
          />
          <Select
            aria-label="Filtrer par type"
            className="w-full sm:w-48"
            placeholder="Tous les types"
            options={options(DOCUMENT_TYPE)}
            value={values.type}
            onChange={(e) => set({ type: e.target.value })}
          />
          <Select
            aria-label="Filtrer par statut"
            className="w-full sm:w-48"
            placeholder="Tous les statuts"
            options={options(EXPIRY_STATUS)}
            value={values.status}
            onChange={(e) => set({ status: e.target.value })}
          />
        </Toolbar>

        {documents.isPending ? (
          <Spinner />
        ) : documents.isError ? (
          <ErrorState error={documents.error} onRetry={() => void documents.refetch()} />
        ) : documents.data.data.length === 0 ? (
          <EmptyState icon={<FileText className="size-6" />} title="Aucun document ne correspond" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Véhicule</Th>
                  <Th>Type</Th>
                  <Th>Expiration</Th>
                  <Th>Statut</Th>
                  <Th>Fichier</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.data.data.map((d) => (
                  <tr key={d.id}>
                    <Td>
                      {d.vehicle && (
                        <Link
                          href={`/vehicles/${d.vehicle.id}`}
                          className="font-medium text-slate-900 hover:text-brand-700"
                        >
                          {d.vehicle.immatriculation}
                        </Link>
                      )}
                    </Td>
                    <Td>{DOCUMENT_TYPE[d.type]}</Td>
                    <Td className="whitespace-nowrap">{formatDate(d.dateExpiration)}</Td>
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
                          Ouvrir
                        </a>
                      ) : (
                        <span className="text-slate-400">Aucun</span>
                      )}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(d)}
                        aria-label="Modifier le document"
                        icon={<Pencil className="size-4" />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(d)}
                        aria-label="Supprimer le document"
                        icon={<Trash2 className="size-4" />}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination meta={documents.data.meta} onPage={(p) => set({ page: p })} />
          </>
        )}
      </Card>

      {editing && (
        <DocumentModal
          document={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmModal
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting)}
          loading={remove.isPending}
          title="Supprimer le document"
          message={`${DOCUMENT_TYPE[deleting.type]} de ${deleting.vehicle?.immatriculation ?? 'ce véhicule'} sera supprimé, ainsi que son fichier.`}
          error={<FormError error={remove.error} />}
        />
      )}
    </>
  );
}
