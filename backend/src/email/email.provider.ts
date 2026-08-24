import { Injectable, Logger } from '@nestjs/common';

/**
 * Uma mensagem pronta para sair.
 *
 * Traz `texto` **e** `html` porque cliente de e-mail que so recebe HTML e
 * cliente que so recebe texto sao os dois casos reais, e o corpo alternativo
 * tambem e o que segura a mensagem fora do spam.
 */
export interface Mensagem {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}

/** O que o envio respondeu. */
export interface ResultadoEnvio {
  /** Saiu de fato para um servidor de e-mail? */
  enviado: boolean;
  /** Qual provedor atendeu — vai para o log e para a tela do admin. */
  provedor: string;
  /** Por que nao saiu, quando `enviado` e falso. */
  motivo?: string;
}

/**
 * Por onde o e-mail sai.
 *
 * **Nasce sem provedor de verdade, de proposito.** O stakeholder nao tem SMTP
 * e nao vai configurar agora (decidido em 24/08), entao o default REGISTRA NO
 * LOG em vez de enviar. Isso deixa a feature inteira — selecao de vagas,
 * corpo, links de um clique — pronta e conferivel hoje, sem depender de uma
 * credencial que ninguem tem.
 *
 * A alternativa seria segurar o card ate haver SMTP. Perde: o trabalho que
 * pode ser verificado agora e quase todo, e o que sobra para o dia do SMTP e
 * trocar a implementacao desta interface.
 */
export abstract class EmailProvider {
  /** Nome curto, para log e para a tela do admin. */
  abstract readonly nome: string;
  /** Este provedor entrega de verdade? */
  abstract readonly entrega: boolean;
  abstract enviar(msg: Mensagem): Promise<ResultadoEnvio>;
}

/**
 * O provedor padrao: escreve no log e nao envia nada.
 *
 * **Nao e um mock de teste** — e o comportamento correto de producao enquanto
 * nao ha SMTP. O que ele NAO pode fazer e mentir: `enviado: false` sempre,
 * para que `ultimoEnvioEm` nao avance e a pessoa nao perca as vagas daquela
 * semana quando o SMTP finalmente entrar.
 */
@Injectable()
export class EmailLogProvider extends EmailProvider {
  readonly nome = 'log';
  readonly entrega = false;
  private readonly log = new Logger('EmailLog');

  enviar(msg: Mensagem): Promise<ResultadoEnvio> {
    // Corpo inteiro nao: o e-mail tem dezenas de linhas de HTML e afogaria o
    // log. O que interessa conferir e para quem foi e com que assunto.
    this.log.log(
      `[NAO ENVIADO — sem SMTP] para=${msg.para} assunto="${msg.assunto}" ` +
        `(${msg.texto.length} chars de texto, ${msg.html.length} de html)`,
    );
    return Promise.resolve({
      enviado: false,
      provedor: this.nome,
      motivo: 'Nenhum provedor de e-mail configurado — a mensagem foi so registrada no log.',
    });
  }
}
