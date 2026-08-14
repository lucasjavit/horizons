import { Body, Controller, Get, Post } from '@nestjs/common';
import { LoginGoogleDto } from './auth.dto';
import type { AuthConfigDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser, Public, type AuthUser } from './current-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Publica: o front precisa saber se ha login antes de desenhar o botao. */
  @Public()
  @Get('config')
  config(): AuthConfigDto {
    return this.auth.config();
  }

  @Public()
  @Post('google')
  google(@Body() body: LoginGoogleDto): Promise<{ user: AuthUser; accessToken: string }> {
    return this.auth.loginComGoogle(body.idToken);
  }

  /** Confirma a sessao. O front so confia no token guardado depois disto. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
