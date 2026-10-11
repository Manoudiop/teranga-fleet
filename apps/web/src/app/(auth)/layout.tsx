import { Truck } from 'lucide-react';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5 text-lg font-semibold">
          <span className="rounded-lg bg-white/10 p-2">
            <Truck className="size-5" aria-hidden />
          </span>
          Teranga Fleet
        </div>
        <div className="space-y-4">
          <p className="text-3xl leading-tight font-semibold">
            Votre flotte, ses documents et ses entretiens, au même endroit.
          </p>
          <p className="text-brand-100/80">
            Assurances, visites techniques et vignettes suivies, entretiens anticipés, kilométrage
            remonté par vos chauffeurs depuis leur téléphone.
          </p>
        </div>
        <p className="text-sm text-brand-100/60">
          Conçu pour les entreprises du Sénégal et d&apos;Afrique de l&apos;Ouest.
        </p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
