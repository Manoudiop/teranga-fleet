import {
  computeMaintenanceDue,
  normalizeMaintenanceType,
  type MaintenanceDueInput,
} from './maintenance-due';

const today = new Date('2026-10-11T09:30:00Z');
const day = (offset: number) => new Date(Date.UTC(2026, 9, 11 + offset));
const options = { today, thresholdDays: 30, kmMargin: 1000 };

let seq = 0;
function record(overrides: Partial<MaintenanceDueInput>): MaintenanceDueInput {
  seq += 1;
  return {
    id: `m${seq}`,
    vehicleId: 'v1',
    type: 'Vidange',
    date: day(-30),
    createdAt: day(-30),
    prochainEntretienKm: null,
    prochainEntretienDate: null,
    ...overrides,
  };
}

const km = (current: number) => new Map([['v1', current]]);

describe('computeMaintenanceDue', () => {
  describe('échéance kilométrique', () => {
    it.each([
      ['dépassée', 130_500, 'OVERDUE', -500],
      ['atteinte pile', 130_000, 'OVERDUE', 0],
      ['dans la marge', 129_200, 'SOON', 800],
      ['au bord de la marge', 129_000, 'SOON', 1000],
    ])('%s', (_label, current, level, remaining) => {
      const [due] = computeMaintenanceDue(
        [record({ prochainEntretienKm: 130_000 })],
        km(current),
        options,
      );
      expect(due).toMatchObject({
        level,
        km: { due: 130_000, current, remaining, level },
        date: null,
      });
    });

    it('pas d’alerte au-delà de la marge', () => {
      expect(
        computeMaintenanceDue([record({ prochainEntretienKm: 130_000 })], km(128_999), options),
      ).toEqual([]);
    });
  });

  describe('échéance calendaire', () => {
    it.each([
      ['dépassée', -1, 'OVERDUE'],
      ["aujourd'hui", 0, 'SOON'],
      ['dans le seuil', 20, 'SOON'],
      ['au bord du seuil', 30, 'SOON'],
    ])('%s', (_label, offset, level) => {
      const [due] = computeMaintenanceDue(
        [record({ prochainEntretienDate: day(offset) })],
        km(0),
        options,
      );
      expect(due).toMatchObject({ level, km: null, date: { daysRemaining: offset, level } });
    });

    it('pas d’alerte au-delà du seuil', () => {
      expect(
        computeMaintenanceDue([record({ prochainEntretienDate: day(31) })], km(0), options),
      ).toEqual([]);
    });
  });

  it('le niveau global est OVERDUE dès qu’une des deux échéances est dépassée', () => {
    const [due] = computeMaintenanceDue(
      [record({ prochainEntretienKm: 100_000, prochainEntretienDate: day(10) })],
      km(100_100),
      options,
    );
    expect(due.level).toBe('OVERDUE');
    expect(due.km?.level).toBe('OVERDUE');
    expect(due.date?.level).toBe('SOON');
  });

  it('seul le dernier entretien de chaque type fixe l’échéance', () => {
    const records = [
      // Ancienne vidange en retard, remplacée par une vidange plus récente.
      record({ type: 'Vidange', date: day(-200), prochainEntretienKm: 120_000 }),
      record({ type: ' vidange ', date: day(-10), prochainEntretienKm: 140_000 }),
      // Révision en retard, non masquée par un entretien d'un autre type plus récent.
      record({
        id: 'revision',
        type: 'Révision générale',
        date: day(-300),
        prochainEntretienKm: 125_000,
      }),
      record({ type: 'Embrayage', date: day(-2) }),
    ];
    const result = computeMaintenanceDue(records, km(130_000), options);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ maintenanceId: 'revision', level: 'OVERDUE' });
  });

  it('un entretien récent sans échéance clôt l’échéance précédente du même type', () => {
    const records = [
      record({ type: 'Vidange', date: day(-200), prochainEntretienKm: 120_000 }),
      record({ type: 'Vidange', date: day(-5) }),
    ];
    expect(computeMaintenanceDue(records, km(130_000), options)).toEqual([]);
  });

  it('à date égale, le dernier enregistré l’emporte', () => {
    const records = [
      record({ id: 'premier', date: day(-5), createdAt: day(-5), prochainEntretienKm: 100 }),
      record({ id: 'second', date: day(-5), createdAt: day(-4), prochainEntretienKm: 999_999 }),
    ];
    expect(computeMaintenanceDue(records, km(50_000), options)).toEqual([]);
  });

  it('traite chaque véhicule séparément', () => {
    const records = [
      record({ vehicleId: 'v1', prochainEntretienKm: 10_000 }),
      record({ vehicleId: 'v2', prochainEntretienKm: 10_000 }),
    ];
    const result = computeMaintenanceDue(
      records,
      new Map([
        ['v1', 20_000],
        ['v2', 1_000],
      ]),
      options,
    );
    expect(result.map((r) => r.vehicleId)).toEqual(['v1']);
  });
});

describe('normalizeMaintenanceType', () => {
  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(normalizeMaintenanceType('  Révision   Générale ')).toBe('revision generale');
  });
});
