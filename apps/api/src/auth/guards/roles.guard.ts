import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { forbidden } from '../../common/errors/app.exception';
import type { Role } from '../../generated/prisma/enums';
import type { AuthUser } from '../auth-user';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';

/**
 * Guard global de contrôle des rôles. Refuse par défaut : une route non
 * publique sans @Roles() n'est accessible à personne, pour qu'un oubli ne
 * puisse pas exposer un endpoint gestionnaire aux chauffeurs.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;

    if (!roles?.length || !user || !roles.includes(user.role)) {
      throw forbidden("Vous n'avez pas les droits nécessaires pour cette action");
    }
    return true;
  }
}
