import { Controller, Get } from '@nestjs/common';
import { AdminOnly } from '../auth/current-user';
import { DeployService, type ProntidaoDto } from './deploy.service';

/**
 * O que falta para publicar.
 *
 * `@AdminOnly()` na classe, como o resto de Configuracoes. A resposta nao
 * carrega valor de segredo nenhum, mas carrega o MAPA do que esta fraco ou
 * faltando — e isso e material de reconhecimento para quem quer entrar. Quem
 * pode ler tem de ser quem ja pode corrigir.
 */
@Controller('settings/deploy')
@AdminOnly()
export class DeployController {
  constructor(private readonly deploy: DeployService) {}

  @Get('prontidao')
  prontidao(): ProntidaoDto {
    return this.deploy.prontidao();
  }
}
