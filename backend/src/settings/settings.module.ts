import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { RecursosController } from './recursos.controller';
import { RecursosService } from './recursos.service';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';

@Module({
  controllers: [SettingsController, RecursosController, DeployController],
  providers: [SettingsService, RecursosService, DeployService],
  exports: [RecursosService],
})
export class SettingsModule {}
