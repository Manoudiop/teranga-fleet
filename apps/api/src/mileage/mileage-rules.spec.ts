import { mileageViolation, type MileageCandidate } from './mileage-rules';

const now = new Date('2026-10-11T18:00:00Z');

const candidate = (overrides: Partial<MileageCandidate> = {}): MileageCandidate => ({
  kilometrage: 128_600,
  date: now,
  current: 128_450,
  lastReadingDate: new Date('2026-10-08T18:00:00Z'),
  now,
  ...overrides,
});

describe('mileageViolation', () => {
  it('accepte un relevé supérieur au compteur', () => {
    expect(mileageViolation(candidate())).toBeNull();
  });

  it('accepte un relevé égal au compteur (véhicule resté immobile)', () => {
    expect(mileageViolation(candidate({ kilometrage: 128_450 }))).toBeNull();
  });

  it('refuse un relevé inférieur au compteur, avec un message lisible', () => {
    expect(mileageViolation(candidate({ kilometrage: 128_449 }))).toEqual({
      error: 'MILEAGE_TOO_LOW',
      message:
        'Le kilométrage saisi (128 449 km) est inférieur au kilométrage actuel du véhicule (128 450 km)',
    });
  });

  it('refuse une date dans le futur (au-delà de 5 minutes de tolérance)', () => {
    expect(mileageViolation(candidate({ date: new Date('2026-10-11T18:04:00Z') }))).toBeNull();
    expect(mileageViolation(candidate({ date: new Date('2026-10-12T08:00:00Z') }))?.message).toBe(
      'La date du relevé ne peut pas être dans le futur',
    );
  });

  it('refuse une date antérieure au dernier relevé', () => {
    expect(
      mileageViolation(candidate({ date: new Date('2026-10-07T18:00:00Z') }))?.message,
    ).toMatch(/antérieure au dernier relevé/);
  });

  it('accepte un premier relevé sans historique', () => {
    expect(mileageViolation(candidate({ lastReadingDate: null, current: 0 }))).toBeNull();
  });
});
