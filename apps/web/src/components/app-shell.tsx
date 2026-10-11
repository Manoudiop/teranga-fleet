'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Bell,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Siren,
  Smartphone,
  Truck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAlerts, useMe } from '@/lib/queries';
import { ErrorState, Spinner } from './ui/feedback';
import { Button, cn } from './ui/primitives';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MANAGER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/vehicles', label: 'Véhicules', icon: Truck },
  { href: '/drivers', label: 'Chauffeurs', icon: Users },
  { href: '/assignments', label: 'Affectations', icon: ArrowLeftRight },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/incidents', label: 'Incidents', icon: Siren },
  { href: '/alerts', label: 'Alertes', icon: Bell },
];

const ADMIN_NAV: NavItem[] = [{ href: '/admin', label: 'Entreprises', icon: Building2 }];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = me.data?.role;

  async function logout() {
    await api('auth/logout', { method: 'POST' }).catch(() => undefined);
    // Aucune donnée de l'ancienne session ne doit rester en cache.
    queryClient.clear();
    router.replace('/login');
  }

  useEffect(() => {
    // L'administrateur de la plateforme n'a pas de flotte : il ne voit que /admin.
    if (role === 'ADMIN' && !pathname.startsWith('/admin')) router.replace('/admin');
  }, [role, pathname, router]);

  if (me.isPending) return <Spinner label="Chargement de votre espace…" />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;

  if (role === 'CHAUFFEUR') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <Smartphone className="mx-auto mb-4 size-10 text-brand-600" aria-hidden />
          <h1 className="text-lg font-semibold">Utilisez l&apos;application mobile</h1>
          <p className="mt-2 text-sm text-slate-500">
            Le tableau de bord web est réservé aux gestionnaires. En tant que chauffeur, saisissez
            votre kilométrage et signalez vos incidents depuis l&apos;application Teranga Fleet.
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => void logout()}
            icon={<LogOut className="size-4" />}
          >
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  const nav = role === 'ADMIN' ? ADMIN_NAV : MANAGER_NAV;
  const sidebar = (
    <Sidebar
      nav={nav}
      pathname={pathname}
      showAlerts={role === 'GESTIONNAIRE'}
      onNavigate={() => setMenuOpen(false)}
    />
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Barre latérale fixe (grand écran) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Tiroir de navigation (mobile) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          <button
            className="absolute top-4 left-68 rounded-md p-1 text-white"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
          >
            <X className="size-6" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button
          className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {me.data.company?.nom ?? 'Administration de la plateforme'}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{me.data.nom}</p>
          <p className="text-xs text-slate-500">{me.data.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          icon={<LogOut className="size-4" />}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

function Sidebar({
  nav,
  pathname,
  showAlerts,
  onNavigate,
}: {
  nav: NavItem[];
  pathname: string;
  /** Ferme le tiroir mobile quand on choisit une page. */
  onNavigate: () => void;
  showAlerts: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-brand-900 text-brand-100">
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-2.5 px-5 text-base font-semibold text-white"
      >
        <span className="rounded-lg bg-white/10 p-1.5">
          <Truck className="size-5" aria-hidden />
        </span>
        Teranga Fleet
      </Link>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navigation principale">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-white/12 text-white'
                  : 'text-brand-100/80 hover:bg-white/6 hover:text-white',
              )}
            >
              <item.icon className="size-4.5 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.href === '/alerts' && showAlerts && <CriticalCount />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Nombre d'alertes critiques, visible depuis toutes les pages. */
function CriticalCount() {
  const alerts = useAlerts();
  const critical = alerts.data?.filter((a) => a.severity === 'CRITICAL').length ?? 0;
  if (!critical) return null;
  return (
    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs leading-none font-semibold text-white">
      {critical}
    </span>
  );
}
