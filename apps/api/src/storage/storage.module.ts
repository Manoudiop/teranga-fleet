import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { Env } from '../config/env.validation';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { FileStoreService } from './file-store.service';
import { StorageService } from './storage.service';

const UploadsModule = MulterModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({
    // Sans « dest » ni « storage », Multer garde le fichier en mémoire : sa signature
    // est vérifiée avant tout enregistrement dans le stockage.
    limits: {
      fileSize: config.get('UPLOAD_MAX_SIZE_MB', { infer: true }) * 1024 * 1024,
      files: 1,
      fields: 20,
    },
  }),
});

@Global()
@Module({
  imports: [UploadsModule],
  providers: [
    FileStoreService,
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): StorageService =>
        config.get('STORAGE_DRIVER', { infer: true }) === 's3'
          ? new S3StorageService({
              S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
              S3_ACCESS_KEY: config.get('S3_ACCESS_KEY', { infer: true }),
              S3_SECRET_KEY: config.get('S3_SECRET_KEY', { infer: true }),
              S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
              S3_REGION: config.get('S3_REGION', { infer: true }),
            })
          : new LocalStorageService(config.get('UPLOAD_DIR', { infer: true })),
    },
  ],
  exports: [StorageService, FileStoreService, UploadsModule],
})
export class StorageModule {}
