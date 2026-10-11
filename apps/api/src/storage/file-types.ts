import { HttpStatus } from '@nestjs/common';
import { AppException, badRequest } from '../common/errors/app.exception';

export type FileKind = 'pdf' | 'jpg' | 'png';

export const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

const LABELS: Record<FileKind, string> = { pdf: 'PDF', jpg: 'JPG/JPEG', png: 'PNG' };

/**
 * Type réel du fichier, déterminé par sa signature binaire (« magic bytes ») :
 * l'extension et le type MIME envoyés par le client ne sont pas fiables.
 */
export function detectFileKind(buffer: Buffer): FileKind | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  return null;
}

/** Vérifie qu'un fichier uploadé est non vide et d'un type autorisé. */
export function assertAllowedFile(
  file: Express.Multer.File,
  allowed: FileKind[],
): { kind: FileKind; contentType: string } {
  if (!file.buffer?.length) throw badRequest('Le fichier est vide');
  const kind = detectFileKind(file.buffer);
  if (!kind || !allowed.includes(kind)) {
    throw new AppException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'UNSUPPORTED_FILE_TYPE',
      `Format de fichier non accepté. Formats autorisés : ${allowed.map((k) => LABELS[k]).join(', ')}`,
    );
  }
  return { kind, contentType: CONTENT_TYPES[kind] };
}
