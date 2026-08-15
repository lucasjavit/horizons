import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CvParserService } from './cv-parser.service';
import { CvExtratorService } from './cv-extrator.service';

@Module({
  imports: [SettingsModule],
  controllers: [JobsController],
  providers: [JobsService, CvParserService, CvExtratorService],
})
export class JobsModule {}
