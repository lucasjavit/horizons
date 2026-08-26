import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { BuscasSalvasService } from './buscas-salvas.service';
import {
  CanaisDaBuscaDto,
  SalvarBuscaDto,
  type BuscaSalvaDto,
} from './job.dto';

/**
 * As buscas salvas do modal de filtros (JOB-41).
 *
 * Sem `@Public()` nem `@SessaoOpcional()`: o guard global e *fail closed*, e
 * estas rotas nascem protegidas — que e o certo aqui. Busca salva tem dono,
 * ao contrario de filtrar, que e anonimo.
 */
@Controller('jobs/saved-searches')
export class BuscasSalvasController {
  constructor(private readonly svc: BuscasSalvasService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser): Promise<BuscaSalvaDto[]> {
    return this.svc.listar(user.id);
  }

  @Post()
  criar(
    @CurrentUser() user: AuthUser,
    @Body() dto: SalvarBuscaDto,
  ): Promise<BuscaSalvaDto> {
    return this.svc.criar(user.id, dto);
  }

  @Put(':id/canais')
  definirCanais(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CanaisDaBuscaDto,
  ): Promise<BuscaSalvaDto> {
    return this.svc.definirCanais(user.id, id, dto.porEmail, dto.porTelegram);
  }

  @Delete(':id')
  apagar(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.svc.apagar(user.id, id);
  }
}
