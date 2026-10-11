import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Connexion' };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Connexion</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Accédez au tableau de bord de votre flotte.
      </p>
      {/* useSearchParams (paramètre « next ») doit être sous une frontière Suspense. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
