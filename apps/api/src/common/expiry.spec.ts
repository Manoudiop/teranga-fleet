import { daysUntil, getExpiryStatus } from '@teranga-fleet/shared';
import { expiryDateFilter } from './expiry-filter';

// Fonction partagée (packages/shared) utilisée par l'API, le web et le mobile.
describe('getExpiryStatus', () => {
  const today = new Date('2026-10-11T15:45:00Z');

  it.each([
    ['expiré hier', '2026-10-10', 'EXPIRE'],
    ["expire aujourd'hui (encore valide ce jour)", '2026-10-11', 'EXPIRANT_BIENTOT'],
    ['expire dans 30 jours (limite incluse)', '2026-11-10', 'EXPIRANT_BIENTOT'],
    ['expire dans 31 jours', '2026-11-11', 'VALIDE'],
    ['expire dans un an', '2027-10-11', 'VALIDE'],
  ])('%s', (_label, expiration, expected) => {
    expect(getExpiryStatus(expiration, 30, today)).toBe(expected);
  });

  it("ne dépend pas de l'heure de la journée", () => {
    const expiration = new Date('2026-10-12T00:00:00Z');
    expect(getExpiryStatus(expiration, 0, new Date('2026-10-11T00:00:01Z'))).toBe('VALIDE');
    expect(getExpiryStatus(expiration, 0, new Date('2026-10-11T23:59:59Z'))).toBe('VALIDE');
    expect(getExpiryStatus(expiration, 0, new Date('2026-10-12T23:59:59Z'))).toBe(
      'EXPIRANT_BIENTOT',
    );
  });

  it('compte les jours restants', () => {
    expect(daysUntil(new Date('2026-10-21'), today)).toBe(10);
    expect(daysUntil(new Date('2026-10-01'), today)).toBe(-10);
  });
});

describe('expiryDateFilter', () => {
  const now = new Date('2026-10-11T15:45:00Z');
  const today = new Date('2026-10-11T00:00:00Z');
  const limit = new Date('2026-11-10T00:00:00Z');

  it('produit des bornes cohérentes avec getExpiryStatus', () => {
    expect(expiryDateFilter('EXPIRE', 30, now)).toEqual({ lt: today });
    expect(expiryDateFilter('EXPIRANT_BIENTOT', 30, now)).toEqual({ gte: today, lte: limit });
    expect(expiryDateFilter('VALIDE', 30, now)).toEqual({ gt: limit });
  });
});
