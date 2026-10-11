import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth-user';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';
import { RolesGuard } from './roles.guard';

function context(user: Partial<AuthUser> | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(metadata: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

const chauffeur = { id: 'u1', role: 'CHAUFFEUR' as const, companyId: 'c1' };
const gestionnaire = { id: 'u2', role: 'GESTIONNAIRE' as const, companyId: 'c1' };

describe('RolesGuard', () => {
  it('laisse passer les routes publiques', () => {
    expect(guardWith({ [IS_PUBLIC_KEY]: true }).canActivate(context(undefined))).toBe(true);
  });

  it('autorise un rôle listé', () => {
    const guard = guardWith({ [ROLES_KEY]: ['GESTIONNAIRE'] });
    expect(guard.canActivate(context(gestionnaire))).toBe(true);
  });

  it('refuse un rôle non listé avec une 403', () => {
    const guard = guardWith({ [ROLES_KEY]: ['GESTIONNAIRE'] });
    try {
      guard.canActivate(context(chauffeur));
      fail('devait lever une exception');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(403);
    }
  });

  it('refuse par défaut une route sans @Roles()', () => {
    expect(() => guardWith({}).canActivate(context(gestionnaire))).toThrow(HttpException);
  });

  it('refuse une route sans utilisateur authentifié', () => {
    const guard = guardWith({ [ROLES_KEY]: ['GESTIONNAIRE'] });
    expect(() => guard.canActivate(context(undefined))).toThrow(HttpException);
  });
});
