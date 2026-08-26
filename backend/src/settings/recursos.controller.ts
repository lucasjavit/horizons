import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { AdminOnly } from '../auth/current-user';
import { RecursosService, type RecursosDto } from './recursos.service';
import type { Capacidade } from '../ia/provedores';

export class DefinirFlagDto {
  @IsBoolean()
  ativa!: boolean;
}

/**
 * Mover um provedor uma posicao na cadeia.
 *
 * **Substitui `DefinirIaDto`**, que gravava UM preferido. A tela agora ordena
 * a lista inteira com setas ↑↓, e uma preferencia unica nao representa o que
 * a pessoa arrumou.
 *
 * `@IsEnum(ApiProvider)` e nao uma lista fixa: o conjunto valido cresce em
 * `prisma/schema.prisma` + `src/ia/provedores.ts`, e repetir os nomes aqui
 * seria um terceiro lugar para esquecer de atualizar. O servico ainda recusa um
 * id que esteja no enum mas fora do registro (FIRECRAWL, por exemplo).
 */
export class MoverProvedorDto {
  @IsEnum(ApiProvider)
  provedor!: ApiProvider;

  /**
   * Para onde. Duas palavras e nao um numero de posicao: a tela move de um em
   * um, e mandar a posicao final abriria a porta para dois cliques rapidos
   * gravarem uma ordem que ninguem viu.
   */
  @IsIn(['cima', 'baixo'])
  direcao!: 'cima' | 'baixo';

  /**
   * Em qual das duas cadeias a pessoa clicou.
   *
   * Sem isto, mover na cadeia de BUSCA (que mostra 3 dos 6) trocaria com um
   * provedor que nao aparece ali — a tela nao mudaria e o botao pareceria
   * quebrado. `@IsOptional()` porque a cadeia de leitura tem os seis e nao
   * precisa filtrar.
   */
  @IsOptional()
  @IsIn(['estruturada', 'buscaWeb'])
  cadeia?: Capacidade;
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
  definirLeituraCv(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirLeituraCv(body.ativa);
  }

  @Put('busca-vagas')
  @AdminOnly()
  definirBuscaVagas(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirBuscaVagas(body.ativa);
  }

  @Put('ats')
  @AdminOnly()
  definirAts(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirAts(body.ativa);
  }

  @Put('freehire')
  @AdminOnly()
  definirFreehire(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirFreehire(body.ativa);
  }

  @Put('busca-agendada')
  @AdminOnly()
  definirBuscaAgendada(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirBuscaAgendada(body.ativa);
  }

  @Put('email-semanal')
  @AdminOnly()
  definirEmailSemanal(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirEmailSemanal(body.ativa);
  }

  @Put('descobertas')
  @AdminOnly()
  definirDescobertas(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirDescobertas(body.ativa);
  }

  @Put('historico')
  @AdminOnly()
  definirHistorico(@Body() body: DefinirFlagDto): Promise<RecursosDto> {
    return this.recursos.definirHistorico(body.ativa);
  }

  @Put('ordem-da-ia')
  @AdminOnly()
  moverProvedor(@Body() body: MoverProvedorDto): Promise<RecursosDto> {
    return this.recursos.moverProvedor(body.provedor, body.direcao, body.cadeia);
  }

  /**
   * Verifica as seis chaves agora.
   *
   * `POST` e nao `GET` porque isto **gasta**: sao ate seis chamadas reais aos
   * provedores. Um GET convidaria o navegador a repetir sozinho, e um prefetch
   * viraria conta a pagar.
   */
  @Post('verificar-chaves')
  @AdminOnly()
  verificarChaves(): Promise<RecursosDto> {
    return this.recursos.verificarChaves();
  }
}
