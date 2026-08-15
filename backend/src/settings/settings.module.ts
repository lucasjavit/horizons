import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { RecursosController } from './recursos.controller';
import { RecursosService } from './recursos.service';

@Module({
  controllers: [SettingsController, RecursosController],
  providers: [SettingsService, RecursosService],
  exports: [RecursosService],
})
export class SettingsModule {}
