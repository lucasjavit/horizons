import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { AdminOnly, CurrentUser, Public, type AuthUser } from '../auth/current-user';
import { EmailService } from './email.service';
import {
  DefinirAtivoDto,
  DefinirCadenciaDto,
  TokenDto,
  type AssinaturaDto,
  type MetricasEmailDto,
  type ResultadoRodadaDto,
} from './email.dto';

/**
 * O e-mail de vagas: assinatura, links de um clique e a rodada de envio.
 *
 * **As rotas de token sao `@Public()` de proposito** — o criterio do JOB-24 e
 * "descadastrar em um clique, SEM login". Exigir sessao no link do rodape
 * transformaria um clique em "entre com o Google, depois procure onde
 * desligar", e quem nao consegue sair marca como spam.
 *
 * O que as protege nao e o guard: e o token de 32 bytes aleatorios, que
 * identifica a assinatura sem expor o e-mail na URL. E `POST`, e nao `GET`,
 * porque o pre-carregador de link de alguns clientes de e-mail dispara `GET`
 * sozinho — a pessoa seria descadastrada sem clicar em nada.
 */
@Controller('email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Get('assinatura')
  minhaAssinatura(@CurrentUser() user: AuthUser): Promise<AssinaturaDto> {
    return this.email.minhaAssinatura(user.id);
  }

  @Put('assinatura/ativo')
  definirAtivo(
    @CurrentUser() user: AuthUser,
    @Body() body: DefinirAtivoDto,
  ): Promise<AssinaturaDto> {
    return this.email.definirAtivo(user.id, body.ativo);
  }

  @Put('assinatura/cadencia')
  definirCadencia(
    @CurrentUser() user: AuthUser,
    @Body() body: DefinirCadenciaDto,
  ): Promise<AssinaturaDto> {
    return this.email.definirCadencia(user.id, body.cadencia);
  }

  // Rota especifica antes de qualquer generica — regra da casa.
  @Post('sair')
  @Public()
  sair(@Query() query: TokenDto): Promise<AssinaturaDto> {
    return this.email.sairPorToken(query.t);
  }

  @Post('contratado')
  @Public()
  contratado(@Query() query: TokenDto): Promise<AssinaturaDto> {
    return this.email.contratadoPorToken(query.t);
  }

  /** O desfazer do JOB-25: voltar a procurar e um clique. */
  @Post('voltar-a-procurar')
  @Public()
  voltarAProcurar(@Query() query: TokenDto): Promise<AssinaturaDto> {
    return this.email.voltarAProcurarPorToken(query.t);
  }

  @Get('metricas')
  @AdminOnly()
  metricas(): Promise<MetricasEmailDto> {
    return this.email.metricas();
  }

  /**
   * Dispara a rodada agora, sem esperar o cron.
   *
   * Existe para conferir a feature: com o provedor de log, e assim que se ve o
   * e-mail sendo montado de verdade para as pessoas reais do banco.
   */
  @Post('rodar')
  @AdminOnly()
  rodar(): Promise<ResultadoRodadaDto> {
    return this.email.rodar();
  }

  /**
   * A previa do que sairia para a propria pessoa, sem enviar.
   *
   * `null` quando nao ha vaga nova — que e exatamente o caso em que o e-mail
   * NAO seria mandado, e a tela precisa poder dizer isso.
   */
  @Get('previa')
  previa(
    @CurrentUser() user: AuthUser,
  ): Promise<{ assunto: string; html: string; texto: string } | null> {
    return this.email.previa(user.id);
  }
}
