import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applique les valeurs par défaut en développement', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      CORS_ORIGINS: [],
      JWT_EXPIRES_IN: '7d',
      STORAGE_DRIVER: 'local',
      UPLOAD_MAX_SIZE_MB: 10,
      ALERT_THRESHOLD_DAYS: 30,
      MAINTENANCE_KM_MARGIN: 1000,
    });
  });

  it.each([
    [undefined, 'loopback'],
    ['false', false],
    ['1', 1],
    ['10.0.0.0/8', '10.0.0.0/8'],
  ])('interprète TRUST_PROXY=%s', (value, expected) => {
    expect(validateEnv({ ...base, TRUST_PROXY: value }).TRUST_PROXY).toBe(expected);
  });

  it('découpe CORS_ORIGINS en liste', () => {
    const env = validateEnv({
      ...base,
      CORS_ORIGINS: 'http://localhost:3001, https://app.example.sn',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3001', 'https://app.example.sn']);
  });

  it('refuse un port invalide', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('exige CORS_ORIGINS en production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/CORS_ORIGINS/);
  });

  it('exige une DATABASE_URL PostgreSQL', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('exige un JWT_SECRET long', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'court' })).toThrow(/JWT_SECRET/);
  });

  it('refuse une durée JWT invalide', () => {
    expect(() => validateEnv({ ...base, JWT_EXPIRES_IN: 'une semaine' })).toThrow(/JWT_EXPIRES_IN/);
  });

  it('exige les identifiants S3 quand STORAGE_DRIVER=s3', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
    const env = validateEnv({
      ...base,
      STORAGE_DRIVER: 's3',
      S3_ACCESS_KEY: 'a',
      S3_SECRET_KEY: 'b',
      S3_BUCKET: 'c',
      S3_REGION: 'd',
    });
    expect(env.STORAGE_DRIVER).toBe('s3');
  });

  describe('emails', () => {
    const production = { ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://app.exemple.sn' };
    const mail = {
      SMTP_URL: 'smtps://cle:secret@smtp-relay.exemple.com:465',
      MAIL_FROM: 'Teranga Fleet <no-reply@exemple.sn>',
      WEB_URL: 'https://app.exemple.sn/',
    };

    it('utilise Mailpit et le dashboard local par défaut en développement', () => {
      expect(validateEnv(base)).toMatchObject({
        MAIL_DRIVER: 'smtp',
        SMTP_URL: 'smtp://localhost:1026',
        WEB_URL: 'http://localhost:3001',
      });
    });

    it('exige le SMTP, l’expéditeur et une WEB_URL https en production', () => {
      expect(() => validateEnv(production)).toThrow(/SMTP_URL[\s\S]*MAIL_FROM[\s\S]*WEB_URL/);
      expect(() =>
        validateEnv({ ...production, ...mail, WEB_URL: 'http://app.exemple.sn' }),
      ).toThrow(/WEB_URL/);
      // La barre finale est retirée pour construire les liens.
      expect(validateEnv({ ...production, ...mail }).WEB_URL).toBe('https://app.exemple.sn');
    });

    it('refuse le pilote memory en production', () => {
      expect(() => validateEnv({ ...production, ...mail, MAIL_DRIVER: 'memory' })).toThrow(
        /MAIL_DRIVER/,
      );
    });
  });
});
