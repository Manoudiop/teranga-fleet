import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let dir: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'teranga-storage-'));
    storage = new LocalStorageService(dir);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('enregistre, relit et supprime un fichier', async () => {
    await storage.put('companies/c1/documents/a.pdf', Buffer.from('%PDF-1.7'), 'application/pdf');
    expect(await readFile(join(dir, 'companies/c1/documents/a.pdf'), 'utf8')).toBe('%PDF-1.7');

    const file = await storage.get('companies/c1/documents/a.pdf');
    expect(file.contentType).toBe('application/pdf');
    expect(file.size).toBe(8);
    file.stream.destroy();

    await storage.delete('companies/c1/documents/a.pdf');
    await expect(storage.get('companies/c1/documents/a.pdf')).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuse d'écraser un fichier existant", async () => {
    await storage.put('k.png', Buffer.from('a'), 'image/png');
    await expect(storage.put('k.png', Buffer.from('b'), 'image/png')).rejects.toThrow();
  });

  it.each(['../secret.txt', '../../etc/passwd', '/etc/passwd', 'a/../../b'])(
    'refuse de sortir du dossier de stockage (%s)',
    async (key) => {
      await expect(storage.get(key)).rejects.toMatchObject({ status: 404 });
      await expect(storage.put(key, Buffer.from('x'), 'text/plain')).rejects.toMatchObject({
        status: 404,
      });
    },
  );

  it('supprimer un fichier absent ne lève pas d’erreur', async () => {
    await expect(storage.delete('absent.pdf')).resolves.toBeUndefined();
  });
});
