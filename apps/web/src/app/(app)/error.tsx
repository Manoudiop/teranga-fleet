'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button, Card } from '@/components/ui/primitives';
import { captureError } from '@/lib/monitoring';

/** Erreur inattendue dans une page : la navigation reste disponible. */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => captureError(error), [error]);

  return (
    <Card className="mx-auto max-w-lg px-6 py-10 text-center">
      <AlertTriangle className="mx-auto mb-4 size-10 text-amber-500" aria-hidden />
      <h1 className="text-lg font-semibold text-slate-900">Cette page a rencontré un problème</h1>
      <p className="mt-2 text-sm text-slate-500">
        Réessayez dans un instant. Si le problème persiste, contactez le support
        {error.digest ? (
          <>
            {' '}
            en indiquant la référence <span className="font-mono">{error.digest}</span>
          </>
        ) : null}
        .
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button icon={<RotateCcw className="size-4" />} onClick={reset}>
          Réessayer
        </Button>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Tableau de bord
        </Link>
      </div>
    </Card>
  );
}
