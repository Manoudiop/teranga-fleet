import { HttpException } from '@nestjs/common';
import type { AuthUser } from './auth-user';
import { companyIdOf } from './decorators';

const user = (overrides: Partial<AuthUser>): AuthUser => ({
  id: 'u1',
  email: 'x@x.sn',
  role: 'GESTIONNAIRE',
  companyId: 'c1',
  driverId: null,
  ...overrides,
});

describe('companyIdOf (source unique du companyId)', () => {
  it("renvoie l'entreprise de l'utilisateur authentifié", () => {
    expect(companyIdOf(user({}))).toBe('c1');
  });

  it('refuse (403) un compte sans entreprise, comme un ADMIN de la plateforme', () => {
    try {
      companyIdOf(user({ role: 'ADMIN', companyId: null }));
      fail('devait lever une exception');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(403);
    }
  });

  it('refuse une requête sans utilisateur', () => {
    expect(() => companyIdOf(undefined)).toThrow(HttpException);
  });
});
