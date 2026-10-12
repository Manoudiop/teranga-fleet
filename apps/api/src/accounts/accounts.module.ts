import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { TeamController } from './team.controller';

@Module({
  controllers: [TeamController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
