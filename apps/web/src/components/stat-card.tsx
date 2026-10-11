import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from './ui/primitives';

const ACCENTS = {
  brand: 'bg-brand-50 text-brand-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
};

/** Indicateur clé du tableau de bord, cliquable vers la page détaillée. */
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = 'brand',
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
  accent?: keyof typeof ACCENTS;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-slate-300"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={cn('rounded-lg p-2', ACCENTS[accent])}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
    </Link>
  );
}
