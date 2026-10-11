import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { Spinner } from '@/components/ui/feedback';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <AppShell>
      {/* Les pages lisent leurs filtres dans l'URL (useSearchParams) : frontière Suspense requise. */}
      <Suspense fallback={<Spinner />}>{children}</Suspense>
    </AppShell>
  );
}
