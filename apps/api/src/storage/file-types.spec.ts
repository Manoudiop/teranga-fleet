import { HttpException } from '@nestjs/common';
import { assertAllowedFile, detectFileKind } from './file-types';

const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n', 'latin1');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

const file = (buffer: Buffer, originalname = 'x.pdf', mimetype = 'application/pdf') =>
  ({ buffer, originalname, mimetype, size: buffer.length }) as Express.Multer.File;

describe('detectFileKind', () => {
  it.each([
    ['PDF', PDF, 'pdf'],
    ['JPEG', JPG, 'jpg'],
    ['PNG', PNG, 'png'],
  ])('reconnaît un %s à sa signature', (_label, buffer, kind) => {
    expect(detectFileKind(buffer)).toBe(kind);
  });

  it.each([
    ['un texte', Buffer.from('bonjour')],
    ['un exécutable Windows', Buffer.from('MZ\x90\x00\x03', 'latin1')],
    ['du HTML', Buffer.from('<html><script>alert(1)</script>')],
    ['un buffer vide', Buffer.alloc(0)],
  ])('ne reconnaît pas %s', (_label, buffer) => {
    expect(detectFileKind(buffer)).toBeNull();
  });
});

describe('assertAllowedFile', () => {
  it('se fie au contenu, pas au nom ni au type MIME déclarés', () => {
    expect(assertAllowedFile(file(PNG, 'scan.pdf', 'application/pdf'), ['pdf', 'png'])).toEqual({
      kind: 'png',
      contentType: 'image/png',
    });
  });

  it('refuse un faux PDF avec une 415', () => {
    try {
      assertAllowedFile(file(Buffer.from('<?php system($_GET[0]); ?>')), ['pdf']);
      fail('devait lever une exception');
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(415);
      expect((e as HttpException).getResponse()).toMatchObject({ error: 'UNSUPPORTED_FILE_TYPE' });
    }
  });

  it('refuse un type valide mais non autorisé pour ce champ', () => {
    expect(() => assertAllowedFile(file(PDF), ['jpg', 'png'])).toThrow(HttpException);
  });

  it('refuse un fichier vide', () => {
    expect(() => assertAllowedFile(file(Buffer.alloc(0)), ['pdf'])).toThrow(HttpException);
  });
});
