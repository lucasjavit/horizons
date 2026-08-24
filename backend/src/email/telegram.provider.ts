import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { NotificacaoProvider, type ResultadoEnvio } from './notificacao.provider';

/**
 * O canal Telegram (JOB-32).
 *
 * **O interruptor mora aqui.** Sem `TELEGRAM_BOT_TOKEN` o provedor fica inerte
 * e registra no log — exatamente como o `EmailLogProvider` faz sem SMTP —, e a
 * regra que isso protege e a mesma: `entrega` responde `false`, entao quem
 * chama nao avanca `ultimoEnvioEm`. No dia em que o token entrar, a pessoa
 * recebe as vagas acumuladas, e nao um comeco do zero.
 *
 * Um provedor so, e nao dois como no e-mail: aqui a diferenca entre entregar e
 * nao entregar e uma variavel de ambiente lida no boot, e nao uma
 * implementacao de transporte diferente. Duas classes seriam a mesma classe
 * com um `if` a mais.
 */

/** A base da Bot API. Constante, e nao variavel: e o endereco do Telegram. */
const API = 'https://api.telegram.org';

/** Teto de espera de uma chamada. Uma rodada nao pode ficar pendurada nela. */
const TIMEOUT_MS = 10_000;

export function temTokenDoBot(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/** O @username do bot, para o deep link `t.me/<bot>?start=<token>`. */
export function usernameDoBot(): string {
  // Sem `@`: o link e `t.me/nome`, e um `@` colado viraria `t.me/@nome`.
  return (process.env.TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '');
}

@Injectable()
export class TelegramProvider extends NotificacaoProvider implements OnModuleInit {
  readonly nome = 'telegram';
  private readonly log = new Logger('Telegram');

  /**
   * Lido uma vez, no boot, e nao a cada envio.
   *
   * Ligar o canal exige reiniciar de qualquer forma (o webhook so se registra
   * no boot), entao reler a variavel a cada mensagem daria a impressao de um
   * interruptor quente que nao existe.
   */
  get entrega(): boolean {
    return temTokenDoBot();
  }

  /**
   * O aviso do criterio de aceite: **uma vez no boot**, e nao a cada rodada.
   *
   * Um log por rodada, de hora em hora, vira ruido que ninguem le — e o aviso
   * que importa e "esta feature esta desligada", que so muda quando a app
   * reinicia.
   */
  onModuleInit(): void {
    if (!this.entrega) {
      this.log.log(
        'canal DESLIGADO: sem TELEGRAM_BOT_TOKEN. A opcao nao aparece na tela, ' +
          'o webhook nao e registrado e nada e enviado.',
      );
      return;
    }
    if (!usernameDoBot()) {
      // Token sem username e configuracao pela metade: o envio funcionaria, mas
      // ninguem conseguiria vincular — o deep link seria `t.me/?start=...`.
      this.log.warn(
        'TELEGRAM_BOT_TOKEN preenchido mas TELEGRAM_BOT_USERNAME vazio: ' +
          'o link de vinculacao nao pode ser montado, e a opcao nao aparece na tela.',
      );
      return;
    }
    this.log.log(`canal ligado, bot @${usernameDoBot()}`);
  }

  /**
   * Manda a mensagem. `chatId` e o endereco; `texto` ja vem renderizado.
   *
   * **Sem `parse_mode` de proposito** — ver `telegram-corpo.ts`: texto literal
   * nao tem marcacao para injetar, e todo titulo de vaga e texto de terceiro.
   */
  async enviar(chatId: bigint, texto: string): Promise<ResultadoEnvio> {
    if (!this.entrega) {
      this.log.log(
        `[NAO ENVIADO — sem TELEGRAM_BOT_TOKEN] chat=${chatId} (${texto.length} chars)`,
      );
      return {
        enviado: false,
        provedor: this.nome,
        motivo: 'Canal do Telegram desligado — a mensagem foi so registrada no log.',
      };
    }

    try {
      const resposta = await this.chamar('sendMessage', {
        chat_id: String(chatId),
        text: texto,
        // A previa do primeiro link ocuparia meia tela do celular e empurraria
        // as outras vagas para baixo. A lista e o conteudo, nao o primeiro item.
        link_preview_options: { is_disabled: true },
      });

      if (resposta.ok) {
        return { enviado: true, provedor: this.nome };
      }

      // **403 e 400 "chat not found" sao descadastro, nao falha.** Caso de
      // borda do card: quem bloqueou o bot mandou parar, e tentar de novo toda
      // semana e o sistema insistindo com quem ja disse nao.
      const invalido =
        resposta.error_code === 403 ||
        /bot was blocked|chat not found|user is deactivated|bot can't initiate/i.test(
          resposta.description ?? '',
        );

      return {
        enviado: false,
        provedor: this.nome,
        motivo: `Telegram recusou (${resposta.error_code ?? '?'}): ${resposta.description ?? 'sem descricao'}`,
        destinoInvalido: invalido,
      };
    } catch (e) {
      // Rede caida NAO e destino invalido: a pessoa continua vinculada e a
      // proxima rodada tenta de novo.
      return {
        enviado: false,
        provedor: this.nome,
        motivo: `falha ao falar com o Telegram: ${String(e).slice(0, 200)}`,
      };
    }
  }

  /**
   * Registra o webhook no Telegram.
   *
   * **O `secret_token` e o que separa "update do Telegram" de "qualquer um que
   * descobriu a URL".** A rota e `@Public()` num guard que e fail closed por
   * projeto; sem este segredo, a unica protecao seria a URL ser dificil de
   * adivinhar — que nao e protecao. O Telegram devolve o valor no header
   * `X-Telegram-Bot-Api-Secret-Token` em toda requisicao, e o controller
   * compara antes de olhar o corpo.
   *
   * Chamado no boot pelo servico, e nao aqui, porque depende da URL publica.
   */
  async registrarWebhook(url: string, segredo: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const r = await this.chamar('setWebhook', {
        url,
        secret_token: segredo,
        // **So `message`.** O bot desta feature so precisa do `/start`; pedir
        // o resto seria superficie e ruido de graca.
        allowed_updates: ['message'],
      });
      return r.ok ? { ok: true } : { ok: false, erro: r.description ?? 'sem descricao' };
    } catch (e) {
      return { ok: false, erro: String(e).slice(0, 200) };
    }
  }

  /** Tira o webhook do ar. Usado quando a URL publica nao e configuravel. */
  async removerWebhook(): Promise<void> {
    try {
      await this.chamar('deleteWebhook', {});
    } catch {
      // Melhor esforco: se nao deu para remover, o boot nao deve cair por isso.
    }
  }

  private async chamar(
    metodo: string,
    corpo: Record<string, unknown>,
  ): Promise<{ ok: boolean; error_code?: number; description?: string }> {
    // `AbortSignal.timeout` e nao um Promise.race: sem abortar de verdade, a
    // requisicao continuaria viva depois de a rodada ter desistido dela.
    const resposta = await fetch(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return (await resposta.json()) as {
      ok: boolean;
      error_code?: number;
      description?: string;
    };
  }
}
