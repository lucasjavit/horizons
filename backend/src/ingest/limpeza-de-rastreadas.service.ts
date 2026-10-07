import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestService, diasSemConfirmacao } from './ingest.service';

/**
 * 4h da manha, todo dia.
 *
 * Uma hora depois da verificacao de ATS (3h) de proposito: as duas mexem no
 * banco de madrugada, e empilha-las no mesmo minuto nao traz nada. Diario e
 * suficiente — o prazo e de dias, entao rodar de hora em hora so adiantaria a
 * remocao em algumas horas e gastaria 24 consultas por dia para isso.
 */
const AS_QUATRO_DA_MANHA = '0 0 4 * * *';

/**
 * Apaga a vaga rastreada que ninguem confirma ha N dias (JOB-50).
 *
 * **Servico proprio, e nao um `@Cron` dentro do `IngestService`.** O
 * `IngestService` e chamado pela rota e pelos testes com datas controladas; um
 * `@Cron` na mesma classe faria o `ScheduleModule` registrar o agendamento em
 * toda suite que a instanciasse, e um job de madrugada disparando no meio do
 * `npm test` e exatamente o tipo de interferencia que nao se depura.
 *
 * O mesmo motivo pelo qual a limpeza do prazo nao e `@Cron` na busca: quem
 * agenda e uma peca, quem decide o que apagar e outra.
 */
@Injectable()
export class LimpezaDeRastreadasService {
  private readonly log = new Logger(LimpezaDeRastreadasService.name);

  constructor(private readonly ingest: IngestService) {}

  @Cron(AS_QUATRO_DA_MANHA, { name: 'limpeza-de-vagas-rastreadas' })
  async rodar(): Promise<void> {
    try {
      const { apagadas } = await this.ingest.limpar();
      if (apagadas > 0) {
        this.log.log(
          `${apagadas} vaga(s) rastreada(s) apagada(s) por ${diasSemConfirmacao()} ` +
            'dia(s) sem confirmacao',
        );
      }
    } catch (e) {
      // Falha de limpeza nao derruba nada: a vaga vencida continua la e a
      // rodada de amanha tenta de novo. Mas APARECE no log — limpeza que falha
      // em silencio e acervo crescendo sem ninguem notar.
      this.log.error(`limpeza falhou: ${String(e).slice(0, 300)}`);
    }
  }
}
