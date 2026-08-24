import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecursosService } from '../settings/recursos.service';
import { EmailService } from './email.service';

/**
 * O relogio do e-mail semanal.
 *
 * **De hora em hora, e nao "uma vez por semana".** Quem decide se ja venceu e
 * o `ultimoEnvioEm` de cada pessoa, e nao o horario do cron: um cron semanal
 * fixo mandaria todo mundo no mesmo minuto, e quem se cadastrasse na terca
 * esperaria ate o proximo domingo para o primeiro e-mail. Varrendo de hora em
 * hora, cada pessoa recebe sete dias depois do SEU ultimo e-mail.
 *
 * Isto tambem faz a rodada ser barata: sem vaga nova ela nao manda nada, e sem
 * ninguem vencido ela nem chega a consultar vaga.
 */

/** No minuto 20 de cada hora — fora do minuto 0, onde todo cron se acumula. */
const DE_HORA_EM_HORA = '0 20 * * * *';

@Injectable()
export class EmailAgendadoService {
  private readonly log = new Logger(EmailAgendadoService.name);
  /** Uma rodada por vez, igual a busca agendada. */
  private rodando = false;

  constructor(
    private readonly recursos: RecursosService,
    private readonly email: EmailService,
  ) {}

  @Cron(DE_HORA_EM_HORA, { name: 'email-de-vagas' })
  async rodar(): Promise<void> {
    // **Gateia no interruptor, e nao em `emailAtivo`.**
    //
    // Medido pelo QA em 24/08: `emailAtivo` e `emailLigado && temProvedor`, e
    // sem SMTP ele e sempre `false` — o cron voltava na primeira linha e nunca
    // montava nada. O agendador era codigo morto, e o criterio "chega e-mail
    // sem a pessoa abrir o site" estava marcado como feito.
    //
    // Com o provedor de log (o padrao ate haver SMTP), rodar E o
    // comportamento certo: e assim que se ve o que sairia. Quem decide se
    // ENTREGA e o provedor, nao o agendador.
    const { emailLigado } = await this.recursos.obter();
    if (!emailLigado) return;

    if (this.rodando) {
      this.log.warn('rodada anterior ainda em andamento — pulando esta');
      return;
    }
    this.rodando = true;
    try {
      await this.email.rodar();
    } catch (e) {
      this.log.error(`rodada de e-mail falhou: ${String(e).slice(0, 300)}`);
    } finally {
      this.rodando = false;
    }
  }
}
