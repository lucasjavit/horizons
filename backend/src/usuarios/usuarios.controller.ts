import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  AdminOnly,
  CurrentUser,
  ManagerOrAdmin,
  type AuthUser,
} from '../auth/current-user';
import {
  ListarUsuariosQueryDto,
  MudarAtivoDto,
  MudarPapelDto,
  type ListaDeUsuariosDto,
  type UsuarioDaListaDto,
} from './usuarios.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Quem se cadastrou, e o que fazer com cada conta (PLT-11).
 *
 * **`@ManagerOrAdmin()` na classe, e `@AdminOnly()` no metodo que muda papel.**
 * O corte do PLT-09 e "Manager opera, Admin configura": ver a lista e desligar
 * uma conta abusiva e operar; promover alguem e configurar.
 *
 * As duas marcacoes convivem porque o guard checa o admin ANTES da gestao —
 * a mais restritiva vence.
 */
@Controller('usuarios')
@ManagerOrAdmin()
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(
    @Query() query: ListarUsuariosQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ListaDeUsuariosDto> {
    return this.usuarios.listar(user, query.q, query.pagina ?? 1);
  }

  @AdminOnly()
  @Patch(':id/papel')
  mudarPapel(
    @Param('id') id: string,
    @Body() body: MudarPapelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UsuarioDaListaDto> {
    return this.usuarios.mudarPapel(user, id, body.role);
  }

  @Patch(':id/ativo')
  mudarAtivo(
    @Param('id') id: string,
    @Body() body: MudarAtivoDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UsuarioDaListaDto> {
    return this.usuarios.mudarAtivo(user, id, body.active);
  }
}
