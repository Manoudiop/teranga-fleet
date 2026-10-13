import { Role } from '../generated/prisma/enums';

/** Utilisateur authentifié, attaché à la requête par la stratégie JWT. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  /** Null uniquement pour un ADMIN de la plateforme. */
  companyId: string | null;
  /** Fiche chauffeur liée au compte (rôle CHAUFFEUR uniquement). */
  driverId: string | null;
}

/** Contenu signé du JWT. Le reste est relu en base à chaque requête. */
export interface JwtPayload {
  sub: string;
  /** Date d'émission en secondes, ajoutée par jsonwebtoken. */
  iat?: number;
}

export const ALL_ROLES = [Role.ADMIN, Role.GESTIONNAIRE, Role.CHAUFFEUR];
