import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [VehiclesModule],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
