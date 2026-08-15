import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CvParserService } from './cv-parser.service';
import { CvExtratorService } from './cv-extrator.service';
import { VagasController } from './vagas.controller';
import { VagasService } from './vagas.service';

@Module({
  imports: [SettingsModule],
  controllers: [JobsController, VagasController],
  providers: [JobsService, CvParserService, CvExtratorService, VagasService],
})
export class JobsModule {}
