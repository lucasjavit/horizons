import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { VagasService } from './vagas.service';
import { SalvasService } from './salvas.service';
import { HistoricoService } from './historico.service';
import {
  DesmarcarVagaDto,
  MarcarVagaDto,
  RemoverSalvaDto,
  SalvarVagaDto,
  type HistoricoDto,
  type VagaDto,
} from './job.dto';

/**
 * As vagas encontradas. Rota propria, e nao sob `/jobs/profile`, porque o
 * recurso e outro: o perfil e o que a pessoa procura; isto e o que se achou.
 */
@Controller('jobs')
export class VagasController {
  constructor(
    private readonly vagas: VagasService,
    private readonly salvas: SalvasService,
    private readonly historico: HistoricoService,
  ) {}

  @Get()
  listar(@CurrentUser() user: AuthUser): Promise<VagaDto[]> {
    return this.vagas.listar(user.id);
  }

  // Rota especifica ANTES da generica com `:param` — senao a generica engole.
  @Get('saved')
  listarSalvas(@CurrentUser() user: AuthUser): Promise<VagaDto[]> {
    return this.salvas.listar(user.id);
  }

  @Post('saved')
  salvar(
    @CurrentUser() user: AuthUser,
    @Body() body: SalvarVagaDto,
  ): Promise<VagaDto> {
    return this.salvas.salvar(user.id, body);
  }

  /**
   * Remove pela URL na query, e nao pelo id no caminho.
   *
   * A tela conhece a vaga pela URL — e o `id` que ela usa na lista de
   * resultados. Exigir o id do registro obrigaria a busca-lo antes, e a
   * estrela precisa desfazer num clique.
   */
  @Delete('saved')
  async remover(
    @CurrentUser() user: AuthUser,
    @Query() query: RemoverSalvaDto,
  ): Promise<void> {
    await this.salvas.remover(user.id, query.url);
  }

  /**
   * O historico da pessoa: o que ela ja viu e o que descartou (JOB-26).
   *
   * **So o dono le o proprio historico.** Nao ha parametro de usuario em rota
   * nenhuma daqui — o `userId` sai sempre do `@CurrentUser()`, que o guard
   * global releu do banco. Uma rota que aceitasse `?userId=` seria o buraco
   * que o criterio de retencao do card fecha.
   */
  @Get('history')
  listarHistorico(@CurrentUser() user: AuthUser): Promise<HistoricoDto> {
    return this.historico.listar(user.id);
  }

  @Post('history')
  marcar(
    @CurrentUser() user: AuthUser,
    @Body() body: MarcarVagaDto,
  ): Promise<HistoricoDto> {
    return this.historico.marcar(user.id, body);
  }

  /** Desfaz o descarte: sem linha, a vaga volta a ser nova. */
  @Delete('history')
  desmarcar(
    @CurrentUser() user: AuthUser,
    @Query() query: DesmarcarVagaDto,
  ): Promise<HistoricoDto> {
    return this.historico.desmarcar(user.id, query.url);
  }
}
