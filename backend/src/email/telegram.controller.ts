import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { CurrentUser, Public, type AuthUser } from '../auth/current-user';
import { TelegramService } from './telegram.service';
import { TelegramWebhookService } from './telegram-webhook.service';
import { type TelegramStatusDto, type TelegramVinculoDto } from './telegram.dto';

/**
 * O canal Telegram (JOB-32).
 *
 * Tres rotas de sessao (status, vincular, desvincular) e **uma unica rota
 * publica**: o webhook. E a terceira rota publica do sistema inteiro, depois de
 * `GET /auth/config` e `POST /auth/google`, e o card a trata como a superficie
 * exposta da feature — porque e.
 */
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly webhook: TelegramWebhookService,
  ) {}

  @Get('status')
  status(@CurrentUser() user: AuthUser): Promise<TelegramStatusDto> {
    return this.telegram.status(user.id);
  }

  /** Passo 2: o deep link que a tela abre. */
  @Post('vincular')
  vincular(@CurrentUser() user: AuthUser): Promise<TelegramVinculoDto> {
    return this.telegram.criarConvite(user.id);
  }

  @Delete('vincular')
  desvincular(@CurrentUser() user: AuthUser): Promise<TelegramStatusDto> {
    return this.telegram.desvincular(user.id);
  }

  /**
   * O webhook do Telegram. **A unica rota publica desta feature.**
   *
   * Tres coisas a protegem, nesta ordem:
   *
   * 1. **Sem `TELEGRAM_BOT_TOKEN`, ela nao existe** — devolve 404, e o webhook
   *    nunca chega a ser registrado no Telegram. Criterio do card, e a mesma
   *    licao do `quadro.json`: feature desligada nao deixa superficie para
   *    tras. Um 404 e nao um 403 de proposito: para quem sonda, a rota nao
   *    responde diferente de qualquer caminho inexistente.
   * 2. **O `secret_token`**, comparado ANTES de olhar o corpo. O Telegram
   *    devolve, no header `X-Telegram-Bot-Api-Secret-Token`, o segredo que
   *    registramos no `setWebhook`. Quem nao o tem nao passa daqui — e o que
   *    separa "update do Telegram" de "qualquer um que descobriu a URL".
   * 3. **O corpo cru, validado a mao** (ver `lerUpdate` em `telegram.dto.ts`):
   *    o `ValidationPipe` global rejeitaria a mensagem legitima com 400,
   *    porque o `Update` do Telegram tem mais campos do que qualquer DTO nosso
   *    cobriria.
   *
   * **Responde 200 sempre**, inclusive quando descarta o update. O Telegram
   * reentrega o que nao recebeu 200 — um erro aqui viraria uma tempestade de
   * reentregas do mesmo update. O que houve vai para o log, nao para o status.
   */
  @Post('webhook')
  @Public()
  @HttpCode(200)
  async receber(
    @Body() corpo: unknown,
    @Headers('x-telegram-bot-api-secret-token') segredo?: string,
  ): Promise<{ ok: true }> {
    if (!this.webhook.rotaDePe()) {
      throw new NotFoundException('Cannot POST /api/telegram/webhook');
    }
    if (!this.webhook.segredoConfere(segredo)) {
      // Nao diz o que estava errado: quem sondou nao ganha pista nenhuma.
      throw new NotFoundException('Cannot POST /api/telegram/webhook');
    }

    await this.webhook.processar(corpo);
    return { ok: true };
  }
}
