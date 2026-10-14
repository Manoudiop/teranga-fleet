'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring';
import './globals.css';

/** Dernier recours : erreur dans la mise en page racine elle-même. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => captureError(error), [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans">
        <main className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Teranga Fleet est momentanément indisponible
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Réessayez dans un instant.
            {error.digest && (
              <>
                {' '}
                Référence pour le support : <span className="font-mono">{error.digest}</span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
