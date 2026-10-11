import { buildAlerts, type AlertsInput } from './build-alerts';

const today = new Date('2026-10-11T12:00:00Z');
const day = (offset: number) => new Date(Date.UTC(2026, 9, 11 + offset));
const opts = { today, thresholdDays: 30 };

const vehicle = { id: 'v1', immatriculation: 'DK-4521-AB', statut: 'ACTIVE' as const };

function input(overrides: Partial<AlertsInput> = {}): AlertsInput {
  return {
    vehicles: [vehicle],
    documents: [],
    drivers: [],
    maintenanceDue: [],
    incidents: [],
    ...overrides,
  };
}

describe('buildAlerts', () => {
  it('ne renvoie rien pour une flotte en règle', () => {
    expect(
      buildAlerts(
        input({
          documents: [{ id: 'd1', vehicleId: 'v1', type: 'ASSURANCE', dateExpiration: day(200) }],
          drivers: [{ id: 'p1', nom: 'Diop', prenom: 'Moussa', dateExpirationPermis: day(500) }],
        }),
        opts,
      ),
    ).toEqual([]);
  });

  describe('documents', () => {
    it('signale un document expiré (CRITICAL) et un document qui expire bientôt (WARNING)', () => {
      const alerts = buildAlerts(
        input({
          documents: [
            { id: 'd1', vehicleId: 'v1', type: 'VIGNETTE', dateExpiration: day(-15) },
            { id: 'd2', vehicleId: 'v1', type: 'ASSURANCE', dateExpiration: day(12) },
          ],
        }),
        opts,
      );
      expect(alerts).toEqual([
        expect.objectContaining({
          id: 'document:d1',
          type: 'DOCUMENT_EXPIRED',
          severity: 'CRITICAL',
          title: 'Vignette expirée',
          message: 'Vignette du véhicule DK-4521-AB expirée depuis le 26/09/2026',
          vehicleId: 'v1',
          documentId: 'd1',
        }),
        expect.objectContaining({
          type: 'DOCUMENT_EXPIRING',
          severity: 'WARNING',
          message: 'Assurance du véhicule DK-4521-AB expire dans 12 jours (23/10/2026)',
        }),
      ]);
    });

    it("n'alerte pas sur un document remplacé par un plus récent du même type", () => {
      const alerts = buildAlerts(
        input({
          documents: [
            { id: 'ancienne', vehicleId: 'v1', type: 'ASSURANCE', dateExpiration: day(-20) },
            { id: 'nouvelle', vehicleId: 'v1', type: 'ASSURANCE', dateExpiration: day(345) },
          ],
        }),
        opts,
      );
      expect(alerts).toEqual([]);
    });
  });

  it('signale les permis expirés ou bientôt expirés', () => {
    const alerts = buildAlerts(
      input({
        drivers: [
          { id: 'p1', nom: 'Diop', prenom: 'Moussa', dateExpirationPermis: day(0) },
          { id: 'p2', nom: 'Sow', prenom: 'Aminata', dateExpirationPermis: day(-1) },
        ],
      }),
      opts,
    );
    expect(alerts.map((a) => [a.type, a.message])).toEqual([
      ['LICENSE_EXPIRED', 'Le permis de Aminata Sow est expiré depuis le 10/10/2026'],
      ['LICENSE_EXPIRING', "Le permis de Moussa Diop expire aujourd'hui (11/10/2026)"],
    ]);
  });

  it('signale les entretiens dépassés et à prévoir avec leur motif', () => {
    const alerts = buildAlerts(
      input({
        maintenanceDue: [
          {
            maintenanceId: 'm1',
            vehicleId: 'v1',
            type: 'Révision générale',
            level: 'OVERDUE',
            km: { due: 210_000, current: 214_900, remaining: -4_900, level: 'OVERDUE' },
            date: null,
          },
          {
            maintenanceId: 'm2',
            vehicleId: 'v1',
            type: 'Plaquettes',
            level: 'SOON',
            km: null,
            date: { due: day(20), daysRemaining: 20, level: 'SOON' },
          },
        ],
      }),
      opts,
    );
    expect(alerts.map((a) => [a.type, a.severity, a.maintenanceId])).toEqual([
      ['MAINTENANCE_OVERDUE', 'CRITICAL', 'm1'],
      ['MAINTENANCE_DUE', 'WARNING', 'm2'],
    ]);
    expect(alerts[0].message).toMatch(
      /^Révision générale du véhicule DK-4521-AB : dépassé de 4.900 km$/,
    );
    expect(alerts[1].message).toBe('Plaquettes du véhicule DK-4521-AB : prévu dans 20 jours');
  });

  it('signale les véhicules hors service (WARNING) et en maintenance (INFO)', () => {
    const alerts = buildAlerts(
      input({
        vehicles: [
          { id: 'v1', immatriculation: 'DK-1', statut: 'MAINTENANCE' },
          { id: 'v2', immatriculation: 'DK-2', statut: 'HORS_SERVICE' },
          { id: 'v3', immatriculation: 'DK-3', statut: 'ACTIVE' },
        ],
      }),
      opts,
    );
    expect(alerts.map((a) => [a.type, a.severity, a.vehicleId])).toEqual([
      ['VEHICLE_OUT_OF_SERVICE', 'WARNING', 'v2'],
      ['VEHICLE_IN_MAINTENANCE', 'INFO', 'v1'],
    ]);
  });

  it('signale les incidents graves ou critiques, pas les mineurs', () => {
    const incident = {
      vehicleId: 'v1',
      driverId: 'p1',
      description: 'Accrochage',
      createdAt: day(-1),
    };
    const alerts = buildAlerts(
      input({
        incidents: [
          { ...incident, id: 'i1', severity: 'CRITICAL' },
          { ...incident, id: 'i2', severity: 'HIGH' },
          { ...incident, id: 'i3', severity: 'MEDIUM' },
          { ...incident, id: 'i4', severity: 'LOW' },
        ],
      }),
      opts,
    );
    expect(alerts.map((a) => [a.incidentId, a.severity])).toEqual([
      ['i1', 'CRITICAL'],
      ['i2', 'WARNING'],
    ]);
  });

  it('trie par priorité puis par échéance la plus proche', () => {
    const alerts = buildAlerts(
      input({
        vehicles: [{ ...vehicle, statut: 'MAINTENANCE' }],
        documents: [
          { id: 'warn-late', vehicleId: 'v1', type: 'ASSURANCE', dateExpiration: day(25) },
          { id: 'warn-soon', vehicleId: 'v1', type: 'VIGNETTE', dateExpiration: day(3) },
          { id: 'crit', vehicleId: 'v1', type: 'VISITE_TECHNIQUE', dateExpiration: day(-2) },
        ],
      }),
      opts,
    );
    expect(alerts.map((a) => a.id)).toEqual([
      'document:crit',
      'document:warn-soon',
      'document:warn-late',
      'vehicle:v1',
    ]);
  });
});
