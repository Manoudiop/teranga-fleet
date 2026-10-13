import { accountBlock, sessionRevoked } from './account-status';

const active = { disabledAt: null };
const disabled = { disabledAt: new Date('2026-10-01') };
const company = { suspendedAt: null };
const suspended = { suspendedAt: new Date('2026-10-01') };

describe('accountBlock', () => {
  it('laisse passer un compte actif dans une entreprise active', () => {
    expect(accountBlock(active, company)).toBeNull();
  });

  it('laisse passer un ADMIN de la plateforme (sans entreprise)', () => {
    expect(accountBlock(active, null)).toBeNull();
  });

  it('bloque un compte désactivé', () => {
    expect(accountBlock(disabled, company)?.error).toBe('ACCOUNT_DISABLED');
  });

  it("bloque tous les comptes d'une entreprise suspendue", () => {
    expect(accountBlock(active, suspended)?.error).toBe('COMPANY_SUSPENDED');
  });

  it('signale en priorité la désactivation du compte', () => {
    expect(accountBlock(disabled, suspended)?.error).toBe('ACCOUNT_DISABLED');
  });
});

describe('sessionRevoked', () => {
  const changedAt = new Date('2026-10-13T10:00:00.500Z');
  const seconds = Math.floor(changedAt.getTime() / 1000);

  it('accepte tout token tant que le mot de passe n’a jamais été réinitialisé', () => {
    expect(sessionRevoked(1, null)).toBe(false);
  });

  it('refuse un token émis avant la réinitialisation', () => {
    expect(sessionRevoked(seconds - 1, changedAt)).toBe(true);
  });

  it('accepte un token émis dans la même seconde ou après', () => {
    expect(sessionRevoked(seconds, changedAt)).toBe(false);
    expect(sessionRevoked(seconds + 60, changedAt)).toBe(false);
  });

  it('refuse un token sans date d’émission après une réinitialisation', () => {
    expect(sessionRevoked(undefined, changedAt)).toBe(true);
  });
});
