import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EmailAgendadoService } from './email-agendado.service';
import { EmailProvider, EmailLogProvider } from './email.provider';

/**
 * O e-mail de vagas (JOB-24) e a mudanca de cadencia de quem foi contratado
 * (JOB-25).
 *
 * `EmailProvider` e resolvido para `EmailLogProvider`: **sem SMTP, o e-mail e
 * registrado no log em vez de enviado.** No dia em que houver credencial,
 * troca-se a classe aqui e nada mais muda — o servico depende da abstracao.
 */
@Module({
  imports: [SettingsModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    EmailAgendadoService,
    { provide: EmailProvider, useClass: EmailLogProvider },
  ],
  exports: [EmailService],
})
export class EmailModule {}
