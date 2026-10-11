import { startOfUtcDay } from '@teranga-fleet/shared';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsDateString } from 'class-validator';
import { applyDecorators } from '@nestjs/common';

export { startOfUtcDay };

/** Ajoute `days` jours à une date (UTC). */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Champ date « AAAA-MM-JJ » (date calendaire, stockée à minuit UTC). */
export const IsCalendarDate = () =>
  applyDecorators(
    Transform(({ value }: TransformFnParams): unknown =>
      typeof value === 'string' ? value.trim().slice(0, 10) : value,
    ),
    IsDateString({ strict: true }, { message: '$property doit être une date valide (AAAA-MM-JJ)' }),
  );

/** Convertit une date calendaire AAAA-MM-JJ en Date (minuit UTC). */
export function toDate(value: string): Date;
export function toDate(value: string | undefined): Date | undefined;
export function toDate(value: string | null | undefined): Date | null | undefined;
export function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
