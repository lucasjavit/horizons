import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser, Public, type AuthUser } from '../auth/current-user';
import { SalvarPerfilDto, type PaisDto, type PerfilDto } from './perfil.dto';
import { PerfilService } from './perfil.service';

@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  /**
   * A lista de paises e publica: e conteudo estatico, igual para todo mundo, e
   * nao diz nada sobre ninguem. Exigir sessao aqui so criaria uma corrida
   * entre carregar a lista e resolver o login.
   */
  @Public()
  @Get('paises')
  paises(): PaisDto[] {
    return this.perfil.paises();
  }

  @Get()
  ler(@CurrentUser() user: AuthUser): Promise<PerfilDto> {
    return this.perfil.ler(user.id);
  }

  @Put()
  salvar(
    @Body() body: SalvarPerfilDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PerfilDto> {
    return this.perfil.salvar(user.id, body);
  }
}
