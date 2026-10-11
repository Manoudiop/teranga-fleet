'use client';

import { useState } from 'react';
import { formatMonth, formatXof } from '@/lib/format';
import type { MaintenanceCosts } from '@/lib/types';

/** 120 000 → « 120 k », 1 250 000 → « 1,3 M » (étiquettes courtes au-dessus des barres). */
function compact(value: number): string {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`;
  return String(value);
}

/** Graduation « ronde » au-dessus du maximum (1, 2, 2,5 ou 5 × 10^n). */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= max) ?? 10;
  return step * power;
}

const CHART_HEIGHT = 180;

/**
 * Coûts d'entretien mensuels : une seule série (pas de légende, le titre la
 * nomme), barres fines à extrémité arrondie, valeur au sommet, infobulle au
 * survol et au focus, tableau des données accessible.
 */
export function CostChart({ data }: { data: MaintenanceCosts }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.months.map((m) => m.total)));
  const ticks = [0, max / 2, max];

  return (
    <div>
      <div className="relative flex gap-3 pl-12" style={{ height: CHART_HEIGHT + 28 }}>
        {/* Axe Y et grille, en retrait */}
        {ticks.map((tick) => (
          <div
            key={tick}
            className="pointer-events-none absolute right-0 left-12 border-t border-slate-100"
            style={{ bottom: 28 + (tick / max) * CHART_HEIGHT }}
          >
            <span className="absolute -top-2 -left-12 w-10 text-right text-xs text-slate-400 tabular-nums">
              {compact(tick)}
            </span>
          </div>
        ))}

        {data.months.map((month, i) => {
          const height = (month.total / max) * CHART_HEIGHT;
          const isActive = active === i;
          return (
            <div
              key={month.month}
              className="relative flex flex-1 flex-col items-center justify-end"
            >
              {isActive && (
                <div
                  role="tooltip"
                  className="absolute z-10 rounded-lg bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg ring-1 ring-slate-200"
                  style={{ bottom: 28 + height + 26 }}
                >
                  <p className="font-medium text-slate-900 capitalize">
                    {formatMonth(month.month)}
                  </p>
                  <p className="text-slate-600 tabular-nums">{formatXof(month.total)}</p>
                  <p className="text-slate-400">
                    {month.count} entretien{month.count > 1 ? 's' : ''}
                  </p>
                </div>
              )}
              {month.total > 0 && (
                <span className="mb-1 text-xs font-medium text-slate-600 tabular-nums">
                  {compact(month.total)}
                </span>
              )}
              {/* Zone de survol plus large que la barre */}
              <button
                type="button"
                className="flex w-full justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                style={{ height: Math.max(height, 4) }}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${formatMonth(month.month)} : ${formatXof(month.total)}, ${month.count} entretien(s)`}
              >
                <span
                  className={`block h-full w-6 rounded-t ${month.total > 0 ? (isActive ? 'bg-brand-700' : 'bg-brand-500') : 'bg-slate-200'}`}
                />
              </button>
              <span className="mt-2 h-5 text-xs text-slate-500 capitalize">
                {formatMonth(month.month)}
              </span>
            </div>
          );
        })}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
          Voir les données
        </summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 font-medium">Mois</th>
              <th className="py-1 text-right font-medium">Entretiens</th>
              <th className="py-1 text-right font-medium">Coût</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.months.map((m) => (
              <tr key={m.month} className="border-t border-slate-100">
                <td className="py-1 capitalize">
                  {formatMonth(m.month)} {m.month.slice(0, 4)}
                </td>
                <td className="py-1 text-right">{m.count}</td>
                <td className="py-1 text-right">{formatXof(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
