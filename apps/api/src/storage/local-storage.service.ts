import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { notFound } from '../common/errors/app.exception';
import { CONTENT_TYPES } from './file-types';
import { StorageService, type StoredFile } from './storage.service';

/** Stockage sur disque, pour le développement. */
export class LocalStorageService extends StorageService {
  private readonly root: string;

  constructor(uploadDir: string) {
    super();
    this.root = resolve(uploadDir);
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' });
  }

  async get(key: string): Promise<StoredFile> {
    const path = this.pathOf(key);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw notFound('Fichier introuvable');
    return {
      stream: createReadStream(path),
      contentType: CONTENT_TYPES[extname(path).slice(1)] ?? 'application/octet-stream',
      size: info.size,
    };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  /** Chemin absolu de la clé, en refusant toute sortie du dossier racine. */
  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw notFound('Fichier introuvable');
    return path;
  }
}
