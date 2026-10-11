import { assignmentViolation, periodViolation, type AssignmentCandidate } from './assignment-rules';

const now = new Date('2026-10-11T10:00:00Z');

function candidate(overrides: Partial<AssignmentCandidate> = {}): AssignmentCandidate {
  return {
    vehicle: { immatriculation: 'DK-4521-AB', statut: 'ACTIVE' },
    driver: {
      prenom: 'Moussa',
      nom: 'Diop',
      statut: 'ACTIF',
      dateExpirationPermis: new Date('2028-01-01'),
    },
    vehicleActiveWith: null,
    driverActiveOn: null,
    dateDebut: now,
    now,
    ...overrides,
  };
}

describe('assignmentViolation', () => {
  it('accepte une affectation valide', () => {
    expect(assignmentViolation(candidate())).toBeNull();
  });

  it('accepte un véhicule en maintenance (seul HORS_SERVICE est bloquant)', () => {
    expect(
      assignmentViolation(candidate({ vehicle: { immatriculation: 'X', statut: 'MAINTENANCE' } })),
    ).toBeNull();
  });

  it('refuse un véhicule hors service', () => {
    expect(
      assignmentViolation(
        candidate({ vehicle: { immatriculation: 'DK-1', statut: 'HORS_SERVICE' } }),
      ),
    ).toEqual({
      error: 'VEHICLE_UNAVAILABLE',
      message: 'Le véhicule DK-1 est hors service et ne peut pas être affecté',
    });
  });

  it('refuse un véhicule déjà affecté', () => {
    expect(assignmentViolation(candidate({ vehicleActiveWith: 'Aminata Sow' }))).toMatchObject({
      error: 'VEHICLE_UNAVAILABLE',
      message: 'Le véhicule DK-4521-AB est déjà affecté à Aminata Sow',
    });
  });

  it('refuse un chauffeur qui conduit déjà un autre véhicule', () => {
    expect(assignmentViolation(candidate({ driverActiveOn: 'TH-2310-A' }))).toMatchObject({
      error: 'DRIVER_UNAVAILABLE',
      message: 'Moussa Diop conduit déjà le véhicule TH-2310-A',
    });
  });

  it.each(['INACTIF', 'SUSPENDU'] as const)('refuse un chauffeur %s', (statut) => {
    const driver = { ...candidate().driver, statut };
    expect(assignmentViolation(candidate({ driver }))?.error).toBe('DRIVER_UNAVAILABLE');
  });

  it('refuse un chauffeur dont le permis est expiré à la date de début', () => {
    const driver = { ...candidate().driver, dateExpirationPermis: new Date('2026-10-10') };
    expect(assignmentViolation(candidate({ driver }))).toMatchObject({
      error: 'DRIVER_UNAVAILABLE',
      message: 'Le permis de Moussa Diop est expiré',
    });
  });

  it('accepte un permis qui expire le jour même', () => {
    const driver = { ...candidate().driver, dateExpirationPermis: new Date('2026-10-11') };
    expect(assignmentViolation(candidate({ driver }))).toBeNull();
  });

  it('refuse une date de début dans le futur, avec 5 minutes de tolérance', () => {
    expect(
      assignmentViolation(candidate({ dateDebut: new Date('2026-10-11T10:04:00Z') })),
    ).toBeNull();
    expect(
      assignmentViolation(candidate({ dateDebut: new Date('2026-10-12T10:00:00Z') }))?.error,
    ).toBe('BAD_REQUEST');
  });
});

describe('periodViolation', () => {
  const start = new Date('2026-10-01T08:00:00Z');

  it('accepte une période en cours ou terminée', () => {
    expect(periodViolation(start, null, now)).toBeNull();
    expect(periodViolation(start, new Date('2026-10-05T18:00:00Z'), now)).toBeNull();
    expect(periodViolation(start, start, now)).toBeNull();
  });

  it('refuse une fin avant le début', () => {
    expect(periodViolation(start, new Date('2026-09-30T08:00:00Z'), now)?.message).toBe(
      'La date de fin doit être postérieure à la date de début',
    );
  });

  it('refuse une fin dans le futur', () => {
    expect(periodViolation(start, new Date('2026-10-20T08:00:00Z'), now)?.message).toBe(
      'La date de fin ne peut pas être dans le futur',
    );
  });
});
