import { accountBlock } from './account-status';

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
