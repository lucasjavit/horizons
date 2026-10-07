import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { LimpezaDeRastreadasService } from './limpeza-de-rastreadas.service';

// PrismaModule e @Global() — nao se importa aqui, so se injeta o servico.
//
// Modulo proprio e nao uma rota a mais em `jobs`: o lado que RECEBE e o
// contrato de outra aplicacao (JOB-49), com segredo proprio e versao propria,
// enquanto `jobs` e a busca que a pessoa usa. Juntar faria o decorador de
// ingestao conviver com `@CurrentUser()` no mesmo controller.
@Module({
  controllers: [IngestController],
  providers: [IngestService, LimpezaDeRastreadasService],
  // O JOB-52 vai ler desta tabela; exportar desde agora evita que a busca
  // acabe falando com o Prisma por fora do servico que e dono dela.
  exports: [IngestService],
})
export class IngestModule {}
