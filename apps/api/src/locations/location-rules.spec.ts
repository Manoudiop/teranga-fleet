import { filterLocationPoints, type LocationPoint } from './location-rules';

const now = new Date('2026-10-11T12:00:00Z');
const opts = { now, assignmentStart: new Date('2026-10-01T08:00:00Z'), maxAgeDays: 7 };
const point = (recordedAt: string, extra: Partial<LocationPoint> = {}): LocationPoint => ({
  latitude: 14.6928,
  longitude: -17.4467,
  recordedAt: new Date(recordedAt),
  ...extra,
});

describe('filterLocationPoints', () => {
  it('accepte des points récents et précis', () => {
    const points = [point('2026-10-11T11:59:00Z', { accuracy: 8 }), point('2026-10-10T09:00:00Z')];
    expect(filterLocationPoints(points, opts)).toEqual({ accepted: points, rejected: 0 });
  });

  it('accepte un léger décalage d’horloge du téléphone (5 minutes)', () => {
    expect(filterLocationPoints([point('2026-10-11T12:04:00Z')], opts).rejected).toBe(0);
  });

  it.each([
    ['dans le futur', point('2026-10-11T13:00:00Z')],
    ['de plus de 7 jours', point('2026-10-04T11:00:00Z')],
    ["d'avant l'affectation en cours", point('2026-09-30T20:00:00Z')],
    ['trop imprécis (antenne relais)', point('2026-10-11T11:00:00Z', { accuracy: 5_000 })],
    ['à la date invalide', { ...point('2026-10-11T11:00:00Z'), recordedAt: new Date('n/a') }],
  ])('écarte un point %s sans rejeter le lot', (_label, bad) => {
    const good = point('2026-10-11T11:00:00Z');
    expect(filterLocationPoints([good, bad], opts)).toEqual({ accepted: [good], rejected: 1 });
  });

  it("borne l'ancienneté par l'affectation quand elle est plus récente que 7 jours", () => {
    const recentAssignment = { ...opts, assignmentStart: new Date('2026-10-11T08:00:00Z') };
    const result = filterLocationPoints(
      [point('2026-10-11T07:59:00Z'), point('2026-10-11T08:01:00Z')],
      recentAssignment,
    );
    expect(result.rejected).toBe(1);
    expect(result.accepted[0].recordedAt.toISOString()).toBe('2026-10-11T08:01:00.000Z');
  });
});
