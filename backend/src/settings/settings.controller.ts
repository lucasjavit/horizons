import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { SetTokenDto, type ApiTokenDto } from './settings.dto';
import { SettingsService } from './settings.service';

/**
 * ATENCAO: o CurrentUserGuard ainda e o stub que aceita qualquer
 * `x-user-email` e nunca rejeita. Enquanto for assim, quem souber o e-mail
 * de alguem consegue guardar e apagar tokens no lugar dessa pessoa — o
 * segredo cifrado no banco protege contra vazamento do dump, nao contra
 * isso. Decisao consciente: vincular a usuario de verdade fica para quando o
 * login existir.
 */
@Controller('settings/tokens')
@UseGuards(CurrentUserGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ApiTokenDto[]> {
    return this.settings.list(user.id);
  }

  @Put()
  setToken(
    @Body() body: SetTokenDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiTokenDto> {
    return this.settings.setToken(user.id, body.provider, body.token);
  }

  @Delete(':provider')
  remove(
    @Param('provider') provider: ApiProvider,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.settings.remove(user.id, provider);
  }
}
