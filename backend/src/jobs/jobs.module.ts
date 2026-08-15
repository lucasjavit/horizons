import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CvParserService } from './cv-parser.service';
import { CvExtratorService } from './cv-extrator.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, CvParserService, CvExtratorService],
})
export class JobsModule {}
