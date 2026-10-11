import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { assertAllowedFile, type FileKind } from './file-types';
import { StorageService } from './storage.service';

/**
 * Opérations communes sur les fichiers uploadés (documents, photos
 * d'incidents) : vérification du type réel, clé générée, suppression tolérante
 * et téléchargement.
 */
@Injectable()
export class FileStoreService {
  private readonly logger = new Logger(FileStoreService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Vérifie puis enregistre le fichier sous companies/<companyId>/<folder>/<uuid>.<ext>.
   * Le nom fourni par le client n'est jamais utilisé.
   */
  async store(
    companyId: string,
    folder: 'documents' | 'incidents',
    file: Express.Multer.File,
    allowed: FileKind[],
  ): Promise<string> {
    const { kind, contentType } = assertAllowedFile(file, allowed);
    const key = `companies/${companyId}/${folder}/${randomUUID()}.${kind}`;
    await this.storage.put(key, file.buffer, contentType);
    return key;
  }

  /** Supprime un fichier sans faire échouer l'opération appelante (les données font foi). */
  async deleteQuietly(key: string | null | undefined): Promise<void> {
    if (!key) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn(`Fichier ${key} non supprimé du stockage : ${String(error)}`);
    }
  }

  /** Réponse de téléchargement, affichée dans le navigateur si possible. */
  async download(key: string, basename: string): Promise<StreamableFile> {
    const file = await this.storage.get(key);
    const extension = key.split('.').pop();
    const filename = `${basename}.${extension}`.replace(/[^\w.-]/g, '_');
    return new StreamableFile(file.stream, {
      type: file.contentType,
      length: file.size,
      disposition: `inline; filename="${filename}"`,
    });
  }
}
