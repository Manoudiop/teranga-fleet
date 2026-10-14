import { Module } from '@nestjs/common';
import { AlertDigestService } from './alert-digest.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertDigestService],
  exports: [AlertsService, AlertDigestService],
})
export class AlertsModule {}
