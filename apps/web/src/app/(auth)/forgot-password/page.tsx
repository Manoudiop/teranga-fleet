import type { Metadata } from 'next';
import { ForgotForm } from './forgot-form';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mot de passe oublié</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        Indiquez l&apos;email de votre compte : vous recevrez un lien pour choisir un nouveau mot de
        passe. Il sert aussi aux chauffeurs de l&apos;application mobile.
      </p>
      <ForgotForm />
    </>
  );
}
