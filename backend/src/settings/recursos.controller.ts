import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AdminOnly } from '../auth/current-user';
import { RecursosService, type RecursosDto } from './recursos.service';

export class DefinirLeituraCvDto {
  @IsBoolean()
  ativa!: boolean;
}

/**
 * Recursos ligaveis pelo admin.
 *
 * A LEITURA e para qualquer sessao, de proposito: a tela de vagas precisa
 * saber se pode oferecer o upload, e quem usa a tela nao e admin. So o que
 * expoe aqui e um booleano — nao ha chave nem segredo nesta resposta.
 *
 * A ESCRITA e @AdminOnly(). O decorator vai no metodo, e nao na classe, para
 * o GET nao herdar a restricao.
 */
@Controller('settings/recursos')
export class RecursosController {
  constructor(private readonly recursos: RecursosService) {}

  @Get()
  obter(): Promise<RecursosDto> {
    return this.recursos.obter();
  }

  @Put('leitura-cv')
  @AdminOnly()
  definirLeituraCv(@Body() body: DefinirLeituraCvDto): Promise<RecursosDto> {
    return this.recursos.definirLeituraCv(body.ativa);
  }
}
