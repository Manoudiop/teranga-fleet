/**
 * Validation des variables d'environnement au démarrage : l'API refuse de
 * démarrer avec une configuration invalide plutôt que d'échouer plus tard.
 * Les variables propres à chaque module (base de données, JWT, stockage)
 * sont ajoutées ici au fil des phases.
 */
export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGINS: string[];
}

const NODE_ENVS = ['development', 'test', 'production'] as const;

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const nodeEnv = typeof raw.NODE_ENV === 'string' ? raw.NODE_ENV : 'development';
  if (!NODE_ENVS.includes(nodeEnv as Env['NODE_ENV'])) {
    errors.push(`NODE_ENV doit valoir ${NODE_ENVS.join(', ')}`);
  }

  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push('PORT doit être un entier entre 1 et 65535');
  }

  const corsOrigins = (typeof raw.CORS_ORIGINS === 'string' ? raw.CORS_ORIGINS : '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (nodeEnv === 'production' && corsOrigins.length === 0) {
    errors.push('CORS_ORIGINS est obligatoire en production');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n- ${errors.join('\n- ')}`);
  }

  return {
    ...raw,
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    CORS_ORIGINS: corsOrigins,
  };
}
