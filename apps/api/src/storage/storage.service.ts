import type { Readable } from 'node:stream';

export interface StoredFile {
  stream: Readable;
  contentType: string;
  size?: number;
}

/**
 * Abstraction du stockage des fichiers. Les modules métier ne dépendent que de
 * cette classe : passer du disque local à S3 se fait par configuration
 * (STORAGE_DRIVER), sans toucher au code métier.
 *
 * Les clés sont générées par l'API (jamais à partir d'un nom fourni par le
 * client) et les fichiers ne sont jamais servis directement : ils passent par
 * des routes authentifiées qui vérifient l'entreprise.
 */
export abstract class StorageService {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Lève une 404 si le fichier n'existe pas. */
  abstract get(key: string): Promise<StoredFile>;
  /** Sans effet si le fichier n'existe pas. */
  abstract delete(key: string): Promise<void>;
}
