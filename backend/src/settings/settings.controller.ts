import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiProvider } from '@prisma/client';
import { AdminOnly, CurrentUser, type AuthUser } from '../auth/current-user';
import { SetTokenDto, type ApiTokenDto } from './settings.dto';
import { SettingsService } from './settings.service';

/**
 * Area de administracao. Antes do PLT-02 o guard era um stub que aceitava
 * qualquer `x-user-email`, entao quem soubesse o e-mail de alguem lia os
 * tokens daquela pessoa. Agora exige sessao real e papel de admin.
 */
@Controller('settings/tokens')
@AdminOnly()
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
