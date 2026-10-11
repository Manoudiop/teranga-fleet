/**
 * Options communes à tous les clients Prisma de l'API (service Nest et seed).
 *
 * `omit` retire le hash du mot de passe de TOUTES les requêtes par défaut :
 * il ne peut pas fuiter par erreur dans une réponse API. Le seul code qui en a
 * besoin (vérification au login) doit le demander explicitement avec
 * `omit: { password: false }`.
 */
export const prismaClientOptions = {
  omit: {
    user: { password: true },
  },
} as const;
