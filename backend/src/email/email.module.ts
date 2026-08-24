import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailAgendadoService } from './email-agendado.service';
import { EmailProvider, EmailLogProvider } from './email.provider';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramProvider } from './telegram.provider';
import { TelegramWebhookService } from './telegram-webhook.service';

/**
 * As notificacoes de vagas: e-mail (JOB-24), cadencia de quem foi contratado
 * (JOB-25) e Telegram (JOB-32).
 *
 * **Um modulo para os dois canais, e nao um `telegram/` paralelo.** E a
 * decisao de arquitetura do JOB-32: a selecao de vagas ("novas desde o ultimo
 * envio, respeitando a cadencia") e a regra que define o produto, e duas
 * implementacoes dela divergiriam na primeira correcao. Aqui ela e uma so, em
 * `EmailService.rodar`, e o que muda por canal e a renderizacao e o carimbo.
 *
 * `EmailProvider` e resolvido para `EmailLogProvider`: **sem SMTP, o e-mail e
 * registrado no log em vez de enviado.** O `TelegramProvider` faz o mesmo sem
 * `TELEGRAM_BOT_TOKEN`, so que numa classe unica — la a diferenca e uma
 * variavel de ambiente, e nao um transporte diferente.
 */
@Module({
  imports: [SettingsModule],
  controllers: [EmailController, TelegramController],
  providers: [
    EmailService,
    EmailAgendadoService,
    { provide: EmailProvider, useClass: EmailLogProvider },
    TelegramService,
    TelegramProvider,
    TelegramWebhookService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
