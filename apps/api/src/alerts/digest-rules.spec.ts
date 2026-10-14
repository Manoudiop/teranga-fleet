import type { Alert } from '@teranga-fleet/shared';
import { digestItems, nextRunAt, utcDay } from './digest-rules';

const alert = (id: string, severity: Alert['severity']): Alert => ({
  id,
  type: 'DOCUMENT_EXPIRED',
  severity,
  title: id,
  message: id,
  vehicleId: null,
  driverId: null,
  documentId: null,
  maintenanceId: null,
  incidentId: null,
  date: null,
});

describe('digestItems', () => {
  const alerts = [alert('a', 'CRITICAL'), alert('b', 'WARNING'), alert('c', 'INFO')];

  it('ne garde que les alertes critiques et à surveiller, dans le même ordre', () => {
    expect(digestItems(alerts, null).map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('ne marque rien comme nouveau lors du premier récapitulatif', () => {
    expect(digestItems(alerts, null).every((a) => !a.isNew)).toBe(true);
  });

  it('marque les alertes absentes du récapitulatif précédent', () => {
    const items = digestItems(alerts, new Set(['a']));
    expect(items.map((a) => [a.id, a.isNew])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });
});

describe('planification', () => {
  it('ramène une date à minuit UTC', () => {
    expect(utcDay(new Date('2026-10-14T23:59:00Z')).toISOString()).toBe('2026-10-14T00:00:00.000Z');
  });

  it("vise l'heure du jour même si elle n'est pas passée", () => {
    expect(nextRunAt(new Date('2026-10-14T05:30:00Z'), 7).toISOString()).toBe(
      '2026-10-14T07:00:00.000Z',
    );
  });

  it('vise le lendemain une fois l’heure atteinte ou passée', () => {
    expect(nextRunAt(new Date('2026-10-14T07:00:00Z'), 7).toISOString()).toBe(
      '2026-10-15T07:00:00.000Z',
    );
    expect(nextRunAt(new Date('2026-12-31T22:00:00Z'), 7).toISOString()).toBe(
      '2027-01-01T07:00:00.000Z',
    );
  });
});
