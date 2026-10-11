import type { Role } from './enums';

/** Utilisateur connecté, tel que renvoyé par /auth/login et /auth/me. */
export interface AuthUserResponse {
  id: string;
  nom: string;
  email: string;
  role: Role;
  company: { id: string; nom: string } | null;
  /** Fiche chauffeur liée au compte (rôle CHAUFFEUR uniquement). */
  driver: { id: string; nom: string; prenom: string } | null;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Durée de validité du token (ex. 7d). */
  expiresIn: string;
  user: AuthUserResponse;
}
