import 'dotenv/config';

/**
 * Base dédiée aux tests e2e : TEST_DATABASE_URL, ou à défaut DATABASE_URL avec
 * le suffixe _test sur le nom de la base. Refuse tout nom qui ne finit pas par
 * _test, pour ne jamais lancer les tests sur la base de développement.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!explicit && !base)
    throw new Error('DATABASE_URL ou TEST_DATABASE_URL requis pour les tests e2e');

  const url = new URL(explicit ?? base!);
  if (!explicit) url.pathname = `${url.pathname.replace(/_test$/, '')}_test`;

  if (!url.pathname.endsWith('_test')) {
    throw new Error(
      `Refus d'utiliser ${url.pathname.slice(1)} pour les tests : le nom doit finir par _test`,
    );
  }
  return url.toString();
}
