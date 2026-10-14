/**
 * Validation des variables d'environnement au démarrage : l'API refuse de
 * démarrer avec une configuration invalide plutôt que d'échouer plus tard.
 */
export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGINS: string[];
  DATABASE_URL: string;
  JWT_SECRET: string;
  /** Durée de validité du token, au format accepté par jsonwebtoken (ex. 7d, 12h). */
  JWT_EXPIRES_IN: string;
  STORAGE_DRIVER: 'local' | 's3';
  UPLOAD_DIR: string;
  UPLOAD_MAX_SIZE_MB: number;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  /** Seuil en jours des alertes « expire bientôt » / « entretien à prévoir ». */
  ALERT_THRESHOLD_DAYS: number;
  /**
   * Proxies de confiance pour lire l'IP réelle du client (X-Forwarded-For) :
   * false, un nombre de sauts, ou une liste express (loopback, 10.0.0.0/8...).
   */
  TRUST_PROXY: boolean | number | string;
  /** Durée de conservation des positions GPS (donnée personnelle), en jours. */
  LOCATION_RETENTION_DAYS: number;
  /** Documentation Swagger sur /docs (active par défaut hors production). */
  SWAGGER_ENABLED: boolean;
  /** Nombre maximal de tentatives de login / inscription par minute et par IP. */
  AUTH_RATE_LIMIT: number;
  /** Marge en km avant le prochain entretien pour déclencher l'alerte « bientôt ». */
  MAINTENANCE_KM_MARGIN: number;
  /** smtp : envoi réel (Mailpit en développement) ; memory : emails gardés en mémoire (tests). */
  MAIL_DRIVER: 'smtp' | 'memory';
  /** smtp(s)://utilisateur:motdepasse@hôte:port du fournisseur (Brevo, Resend, Mailjet...). */
  SMTP_URL: string;
  /** Expéditeur des emails, ex. « Teranga Fleet <no-reply@teranga-fleet.sn> ». */
  MAIL_FROM: string;
  /** Adresse publique du dashboard web, pour les liens envoyés par email. */
  WEB_URL: string;
  /** Heure UTC (= heure de Dakar) de l'envoi du récapitulatif quotidien des alertes. */
  ALERT_DIGEST_HOUR: number;
}

const NODE_ENVS = ['development', 'test', 'production'] as const;
const STORAGE_DRIVERS = ['local', 's3'] as const;
const MAIL_DRIVERS = ['smtp', 'memory'] as const;

function str(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === 'string' ? value.trim() : '';
}

function int(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
  errors: string[],
): number {
  const text = str(raw, key);
  const value = text === '' ? fallback : Number(text);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${key} doit être un entier entre ${min} et ${max}`);
  }
  return value;
}

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'false') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const nodeEnv = str(raw, 'NODE_ENV') || 'development';
  if (!NODE_ENVS.includes(nodeEnv as Env['NODE_ENV'])) {
    errors.push(`NODE_ENV doit valoir ${NODE_ENVS.join(', ')}`);
  }

  const port = int(raw, 'PORT', 4000, 1, 65535, errors);

  const corsOrigins = str(raw, 'CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (nodeEnv === 'production' && corsOrigins.length === 0) {
    errors.push('CORS_ORIGINS est obligatoire en production');
  }

  const databaseUrl = str(raw, 'DATABASE_URL');
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL doit être une URL PostgreSQL (postgresql://...)');
  }

  const jwtSecret = str(raw, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET doit contenir au moins 32 caractères (voir .env.example)');
  }
  const jwtExpiresIn = str(raw, 'JWT_EXPIRES_IN') || '7d';
  if (!/^\d+[smhd]?$/.test(jwtExpiresIn)) {
    errors.push('JWT_EXPIRES_IN doit être une durée comme 3600, 12h ou 7d');
  }

  const storageDriver = str(raw, 'STORAGE_DRIVER') || 'local';
  if (!STORAGE_DRIVERS.includes(storageDriver as Env['STORAGE_DRIVER'])) {
    errors.push(`STORAGE_DRIVER doit valoir ${STORAGE_DRIVERS.join(' ou ')}`);
  }
  if (storageDriver === 's3') {
    for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET', 'S3_REGION']) {
      if (!str(raw, key)) errors.push(`${key} est obligatoire avec STORAGE_DRIVER=s3`);
    }
  }

  const isProduction = nodeEnv === 'production';
  const mailDriver = str(raw, 'MAIL_DRIVER') || 'smtp';
  if (!MAIL_DRIVERS.includes(mailDriver as Env['MAIL_DRIVER'])) {
    errors.push(`MAIL_DRIVER doit valoir ${MAIL_DRIVERS.join(' ou ')}`);
  } else if (mailDriver === 'memory' && isProduction) {
    errors.push('MAIL_DRIVER=memory est réservé aux tests : aucun email ne partirait');
  }
  // Valeurs par défaut de développement : Mailpit (docker-compose) et le dashboard local.
  const smtpUrl = str(raw, 'SMTP_URL') || (isProduction ? '' : 'smtp://localhost:1026');
  if (mailDriver === 'smtp' && !/^smtps?:\/\/[^/]+/.test(smtpUrl)) {
    errors.push('SMTP_URL doit être une URL smtp:// ou smtps:// (obligatoire en production)');
  }
  const mailFrom =
    str(raw, 'MAIL_FROM') ||
    (isProduction ? '' : 'Teranga Fleet <no-reply@teranga-fleet.localhost>');
  if (!mailFrom.includes('@')) {
    errors.push('MAIL_FROM doit contenir une adresse email (obligatoire en production)');
  }
  const webUrl = (str(raw, 'WEB_URL') || (isProduction ? '' : 'http://localhost:3001')).replace(
    /\/+$/,
    '',
  );
  if (!(isProduction ? /^https:\/\/\S+$/ : /^https?:\/\/\S+$/).test(webUrl)) {
    errors.push(
      isProduction
        ? "WEB_URL doit être l'adresse https:// du dashboard en production"
        : 'WEB_URL doit être une URL http(s)://',
    );
  }

  const env: Env = {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    CORS_ORIGINS: corsOrigins,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    STORAGE_DRIVER: storageDriver as Env['STORAGE_DRIVER'],
    UPLOAD_DIR: str(raw, 'UPLOAD_DIR') || './uploads',
    UPLOAD_MAX_SIZE_MB: int(raw, 'UPLOAD_MAX_SIZE_MB', 10, 1, 50, errors),
    S3_ENDPOINT: str(raw, 'S3_ENDPOINT') || undefined,
    S3_ACCESS_KEY: str(raw, 'S3_ACCESS_KEY') || undefined,
    S3_SECRET_KEY: str(raw, 'S3_SECRET_KEY') || undefined,
    S3_BUCKET: str(raw, 'S3_BUCKET') || undefined,
    S3_REGION: str(raw, 'S3_REGION') || undefined,
    ALERT_THRESHOLD_DAYS: int(raw, 'ALERT_THRESHOLD_DAYS', 30, 1, 365, errors),
    MAINTENANCE_KM_MARGIN: int(raw, 'MAINTENANCE_KM_MARGIN', 1000, 0, 100_000, errors),
    AUTH_RATE_LIMIT: int(raw, 'AUTH_RATE_LIMIT', 10, 1, 10_000, errors),
    LOCATION_RETENTION_DAYS: int(raw, 'LOCATION_RETENTION_DAYS', 90, 1, 3650, errors),
    TRUST_PROXY: parseTrustProxy(str(raw, 'TRUST_PROXY') || 'loopback'),
    SWAGGER_ENABLED: str(raw, 'SWAGGER_ENABLED')
      ? str(raw, 'SWAGGER_ENABLED') === 'true'
      : nodeEnv !== 'production',
    MAIL_DRIVER: mailDriver as Env['MAIL_DRIVER'],
    SMTP_URL: smtpUrl,
    MAIL_FROM: mailFrom,
    WEB_URL: webUrl,
    ALERT_DIGEST_HOUR: int(raw, 'ALERT_DIGEST_HOUR', 7, 0, 23, errors),
  };

  if (errors.length > 0) {
    throw new Error(`Configuration invalide :\n- ${errors.join('\n- ')}`);
  }
  return env;
}
