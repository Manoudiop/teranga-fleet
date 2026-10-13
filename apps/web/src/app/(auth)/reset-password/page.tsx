import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetForm } from './reset-form';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
  // Le jeton est dans l'URL : il ne doit pas fuiter vers d'autres sites via le Referer.
  referrer: 'no-referrer',
};

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nouveau mot de passe</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Choisissez le mot de passe de votre compte Teranga Fleet.
      </p>
      {/* useSearchParams (jeton du lien) doit être sous une frontière Suspense. */}
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
