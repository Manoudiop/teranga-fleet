import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

describe('validateEnv', () => {
  it('applique les valeurs par défaut en développement', () => {
    const env = validateEnv({ DATABASE_URL });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('découpe CORS_ORIGINS en liste', () => {
    const env = validateEnv({
      DATABASE_URL,
      CORS_ORIGINS: 'http://localhost:3001, https://app.example.sn',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3001', 'https://app.example.sn']);
  });

  it('refuse un port invalide', () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('exige CORS_ORIGINS en production', () => {
    expect(() => validateEnv({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(/CORS_ORIGINS/);
  });

  it('exige une DATABASE_URL PostgreSQL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });
});
