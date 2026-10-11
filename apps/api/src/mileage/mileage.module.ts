import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { MileageController } from './mileage.controller';
import { MileageService } from './mileage.service';

@Module({
  imports: [VehiclesModule],
  controllers: [MileageController],
  providers: [MileageService],
})
export class MileageModule {}
