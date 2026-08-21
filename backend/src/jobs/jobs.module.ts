import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CvParserService } from './cv-parser.service';
import { CvExtratorService } from './cv-extrator.service';
import { VagasController } from './vagas.controller';
import { VagasService } from './vagas.service';
import { BuscaController } from './busca.controller';
import { BuscaService } from './busca.service';
import { BuscaIaService } from './busca-ia.service';
import { BuscaAtsService } from './busca-ats.service';
import { BuscaAgendadaService } from './busca-agendada.service';

@Module({
  imports: [SettingsModule],
  controllers: [JobsController, VagasController, BuscaController],
  providers: [JobsService, CvParserService, CvExtratorService, VagasService, BuscaService, BuscaIaService, BuscaAtsService, BuscaAgendadaService],
})
export class JobsModule {}
