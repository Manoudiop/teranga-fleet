'use client';

import type { PaginatedResponse } from '@teranga-fleet/shared';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { Button, cn } from './primitives';

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"
      role="status"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-red-50 p-3 text-red-500">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-900">Impossible de charger les données</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

/** Message d'erreur dans un formulaire. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div
      className="flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-600/15"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{errorMessage(error)}</span>
    </div>
  );
}

export function Pagination({
  meta,
  onPage,
}: {
  meta: PaginatedResponse<unknown>['meta'];
  onPage: (page: number) => void;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        {from}–{to} sur {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Page précédente"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          icon={<ChevronLeft className="size-4" />}
        />
        <span className="px-2">
          Page {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Page suivante"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          icon={<ChevronRight className="size-4" />}
        />
      </div>
    </div>
  );
}

/** Barre de filtres au-dessus d'un tableau. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
