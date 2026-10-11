import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { notFound } from '../common/errors/app.exception';
import type { Env } from '../config/env.validation';
import { StorageService, type StoredFile } from './storage.service';

/** Stockage S3-compatible (AWS S3, MinIO, Scaleway, OVH...), pour la production. */
export class S3StorageService extends StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    env: Pick<Env, 'S3_ENDPOINT' | 'S3_ACCESS_KEY' | 'S3_SECRET_KEY' | 'S3_BUCKET' | 'S3_REGION'>,
  ) {
    super();
    this.bucket = env.S3_BUCKET!;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      // Les fournisseurs compatibles S3 (MinIO notamment) attendent des URL par chemin.
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<StoredFile> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        stream: res.Body as Readable,
        contentType: res.ContentType ?? 'application/octet-stream',
        size: res.ContentLength,
      };
    } catch (error) {
      if (error instanceof NoSuchKey) throw notFound('Fichier introuvable');
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
