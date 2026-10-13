import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { MailService } from './mail.service';
import { MemoryMailService } from './memory-mail.service';
import { SmtpMailService } from './smtp-mail.service';

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MailService =>
        config.get('MAIL_DRIVER', { infer: true }) === 'memory'
          ? new MemoryMailService()
          : new SmtpMailService(
              config.get('SMTP_URL', { infer: true }),
              config.get('MAIL_FROM', { infer: true }),
            ),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
