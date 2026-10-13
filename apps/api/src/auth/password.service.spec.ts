import { PasswordService } from './password.service';

// argon2 est lent par conception : sous la charge des suites en parallèle, 5 s ne suffisent pas toujours.
jest.setTimeout(20_000);

describe('PasswordService', () => {
  const service = new PasswordService();

  beforeAll(() => service.onModuleInit());

  it('hache en argon2id et ne stocke jamais le mot de passe en clair', async () => {
    const hash = await service.hash('MotDePasse123');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('MotDePasse123');
  });

  it('vérifie le bon mot de passe et refuse les autres', async () => {
    const hash = await service.hash('MotDePasse123');
    await expect(service.verify(hash, 'MotDePasse123')).resolves.toBe(true);
    await expect(service.verify(hash, 'motdepasse123')).resolves.toBe(false);
  });

  it('refuse toujours quand il n’y a pas de hash (compte inexistant)', async () => {
    await expect(service.verify(null, 'mot-de-passe-factice-pour-egaliser-le-temps')).resolves.toBe(
      false,
    );
  });

  it('refuse un hash corrompu sans lever d’exception', async () => {
    await expect(service.verify('pas-un-hash', 'x')).resolves.toBe(false);
  });
});
