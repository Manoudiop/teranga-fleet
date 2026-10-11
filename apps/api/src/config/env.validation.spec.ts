import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applique les valeurs par défaut en développement', () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('découpe CORS_ORIGINS en liste', () => {
    const env = validateEnv({ CORS_ORIGINS: 'http://localhost:3001, https://app.example.sn' });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3001', 'https://app.example.sn']);
  });

  it('refuse un port invalide', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('exige CORS_ORIGINS en production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/CORS_ORIGINS/);
  });
});
