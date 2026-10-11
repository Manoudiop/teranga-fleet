import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { S3StorageService } from './s3-storage.service';

describe('S3StorageService', () => {
  const send = jest.spyOn(S3Client.prototype, 'send');
  const storage = new S3StorageService({
    S3_ENDPOINT: 'https://s3.example.test',
    S3_ACCESS_KEY: 'access',
    S3_SECRET_KEY: 'secret',
    S3_BUCKET: 'teranga-fichiers',
    S3_REGION: 'eu-west-3',
  });

  beforeEach(() => send.mockReset());
  afterAll(() => send.mockRestore());

  it('envoie le fichier dans le bucket avec son type', async () => {
    send.mockResolvedValue({} as never);
    await storage.put('companies/c1/documents/a.pdf', Buffer.from('%PDF'), 'application/pdf');

    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'teranga-fichiers',
      Key: 'companies/c1/documents/a.pdf',
      ContentType: 'application/pdf',
    });
  });

  it('relit un fichier sous forme de flux', async () => {
    const body = Readable.from([Buffer.from('%PDF')]);
    send.mockResolvedValue({
      Body: body,
      ContentType: 'application/pdf',
      ContentLength: 4,
    } as never);

    const file = await storage.get('k.pdf');
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(file).toEqual({ stream: body, contentType: 'application/pdf', size: 4 });
  });

  it('traduit un objet absent en 404', async () => {
    send.mockRejectedValue(new NoSuchKey({ message: 'absent', $metadata: {} }) as never);
    await expect(storage.get('absent.pdf')).rejects.toMatchObject({ status: 404 });
  });

  it('propage les autres erreurs (ex. identifiants invalides)', async () => {
    send.mockRejectedValue(new Error('AccessDenied') as never);
    await expect(storage.get('k.pdf')).rejects.toThrow('AccessDenied');
  });

  it('supprime un fichier', async () => {
    send.mockResolvedValue({} as never);
    await storage.delete('k.pdf');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({
      Bucket: 'teranga-fichiers',
      Key: 'k.pdf',
    });
  });
});
