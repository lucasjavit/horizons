import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { TelegramProvider, temTokenDoBot, usernameDoBot } from './telegram.provider';
import { TelegramService } from './telegram.service';
import { lerStart, lerUpdate } from './telegram.dto';

/**
 * O webhook do Telegram: registro no boot e processamento do update (JOB-32).
 *
 * Separado do `TelegramService` porque sao responsabilidades diferentes: aquele
 * cuida do vinculo (regra de produto), este da porta de entrada (transporte e
 * seguranca). Junta-los deixaria a regra de negocio dependendo do boot.
 */

/** O caminho da rota, para montar a URL do `setWebhook`. */
const CAMINHO = '/api/telegram/webhook';

@Injectable()
export class TelegramWebhookService implements OnModuleInit {
  private readonly log = new Logger('TelegramWebhook');
  /** Resolvido no boot. Vazio = a rota nao esta de pe. */
  private segredo = '';

  constructor(
    private readonly provider: TelegramProvider,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * A rota so responde quando o canal esta ligado.
   *
   * **Criterio do card**: sem `TELEGRAM_BOT_TOKEN`, o webhook nao fica de pe.
   * Feature desligada nao deixa superficie exposta para tras.
   */
  rotaDePe(): boolean {
    return this.segredo.length > 0;
  }

  /**
   * O header bate com o segredo registrado?
   *
   * `timingSafeEqual` e nao `===`: comparacao de string sai no primeiro
   * caractere diferente, e o tempo da resposta vaza quanto do segredo o
   * atacante ja acertou. E o mesmo cuidado que se toma com senha, e custa uma
   * linha.
   *
   * Os dois lados passam por SHA-256 antes de comparar para o `timingSafeEqual`
   * receber sempre buffers do mesmo tamanho — ele lanca se forem diferentes, e
   * o proprio lancamento vazaria o tamanho do segredo.
   */
  segredoConfere(recebido?: string): boolean {
    if (!this.rotaDePe() || !recebido) return false;
    const a = createHash('sha256').update(recebido).digest();
    const b = createHash('sha256').update(this.segredo).digest();
    return timingSafeEqual(a, b);
  }

  /**
   * Registra o webhook no Telegram, uma vez, no boot.
   *
   * Nao derruba a aplicacao se falhar: um Telegram fora do ar, ou uma URL que
   * ainda nao esta publica, nao pode impedir as trilhas e o e-mail de subirem.
   * O que ele faz e **dizer alto no log** — falha silenciosa aqui viraria "o
   * bot nao responde e ninguem sabe por que".
   */
  async onModuleInit(): Promise<void> {
    if (!temTokenDoBot() || !usernameDoBot()) return;

    const url = this.urlDoWebhook();
    if (!url) {
      this.log.warn(
        'canal ligado, mas sem URL publica HTTPS: defina TELEGRAM_WEBHOOK_URL ou APP_URL ' +
          '(https://). O webhook NAO foi registrado e a vinculacao nao vai concluir.',
      );
      return;
    }

    this.segredo = segredoDoWebhook();

    const r = await this.provider.registrarWebhook(url, this.segredo);
    if (r.ok) {
      this.log.log(`webhook registrado em ${url}`);
    } else {
      // A rota continua de pe: o segredo ja foi resolvido, e um registro que
      // falhou pode ser reparado por fora (o `setWebhook` e idempotente).
      this.log.error(`falha ao registrar o webhook em ${url}: ${r.erro}`);
    }
  }

  /**
   * A URL publica do webhook.
   *
   * `TELEGRAM_WEBHOOK_URL` quando informada; senao deriva de `APP_URL`, como o
   * card decidiu. **Exige HTTPS**: o Telegram so entrega em HTTPS, nas portas
   * 443, 80, 88 ou 8443 — registrar `http://localhost` falharia de qualquer
   * forma, e recusar aqui produz um aviso legivel em vez de um erro da API do
   * Telegram.
   */
  private urlDoWebhook(): string | null {
    const explicita = process.env.TELEGRAM_WEBHOOK_URL?.trim();
    if (explicita) {
      return explicita.startsWith('https://') ? explicita.replace(/\/+$/, '') : null;
    }
    const base = process.env.APP_URL?.trim();
    if (!base || !base.startsWith('https://')) return null;
    return `${base.replace(/\/+$/, '')}${CAMINHO}`;
  }

  /**
   * Processa um update. **Nunca lanca** — ver o controller: erro aqui vira
   * reentrega em cadeia do Telegram.
   */
  async processar(corpo: unknown): Promise<void> {
    try {
      const update = lerUpdate(corpo);
      // Nao e mensagem de texto (foto, sticker, entrada em grupo...). O
      // `allowed_updates: ['message']` ja reduz isso, mas nao a zero.
      if (!update) return;

      const payload = lerStart(update.texto);
      if (payload === null) {
        // O bot so entrega; conversar com ele esta fora de escopo (card). Uma
        // resposta curta e melhor que silencio para quem digitou algo.
        await this.responder(
          update.chatId,
          'I only deliver job alerts. Manage them on Horizons, in the Jobs tab.',
        );
        return;
      }

      const resposta = await this.telegram.processarStart(
        update.chatId,
        payload,
        update.username,
      );
      await this.responder(update.chatId, resposta);
    } catch (e) {
      this.log.error(`falha ao processar update: ${String(e).slice(0, 300)}`);
    }
  }

  /**
   * Responde na conversa, **e registra quando nao consegue**.
   *
   * O `enviar` devolve o motivo em vez de lancar, entao sem esta checagem uma
   * resposta que nao sai nao deixa rastro nenhum: o vinculo apareceria criado
   * no log e a pessoa nao veria confirmacao nenhuma no Telegram, sem nada que
   * ligasse as duas coisas. Foi o que aconteceu no teste local com token falso.
   */
  private async responder(chatId: bigint, texto: string): Promise<void> {
    const r = await this.provider.enviar(chatId, texto);
    if (!r.enviado) {
      this.log.warn(`resposta ao chat ${chatId} nao saiu: ${r.motivo ?? 'motivo nao informado'}`);
    }
  }
}

/**
 * O segredo do `secret_token`.
 *
 * **Derivado do token do bot quando nao ha variavel propria**, e nao aleatorio
 * por boot: com um valor novo a cada reinicio, um deploy com duas instancias
 * (ou um restart no meio de uma vinculacao) faria uma delas rejeitar os
 * updates registrados pela outra. Derivar da credencial que ja existe da um
 * segredo estavel, unico por bot — e portanto diferente entre desenvolvimento
 * e producao, que e o ponto dos dois tokens.
 *
 * `TELEGRAM_WEBHOOK_SECRET` tem precedencia para quem quiser gira-lo sem
 * trocar o bot.
 *
 * O alfabeto do Telegram e `A-Z a-z 0-9 _ -`, 1 a 256 caracteres: o hex do
 * SHA-256 cabe nele com folga.
 */
function segredoDoWebhook(): string {
  const proprio = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (proprio) {
    // So o que o Telegram aceita. Um segredo com caractere invalido faria o
    // `setWebhook` recusar, e a feature ficaria muda por um erro de digitacao.
    const limpo = proprio.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 256);
    if (limpo.length >= 16) return limpo;
  }
  return createHash('sha256')
    .update(`horizons:telegram:webhook:${process.env.TELEGRAM_BOT_TOKEN ?? ''}`)
    .digest('hex');
}
