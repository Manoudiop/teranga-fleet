import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { forbidden } from '../common/errors/app.exception';
import type { Role } from '../generated/prisma/enums';
import type { AuthUser } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Route accessible sans authentification. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Rôles autorisés. Obligatoire sur toute route non publique : le RolesGuard
 * refuse les routes qui n'en déclarent pas (sécurité par défaut).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

function userFrom(ctx: ExecutionContext): AuthUser {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
}

/** Utilisateur authentifié. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  userFrom(ctx),
);

/**
 * Entreprise de l'utilisateur authentifié : c'est la SEULE source du companyId
 * utilisée pour filtrer les données. Un éventuel companyId envoyé par le client
 * est ignoré (et rejeté par la validation des DTO).
 */
export function companyIdOf(user: AuthUser | undefined): string {
  if (!user?.companyId) throw forbidden("Ce compte n'est rattaché à aucune entreprise");
  return user.companyId;
}

export const CompanyId = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  companyIdOf(userFrom(ctx)),
);
