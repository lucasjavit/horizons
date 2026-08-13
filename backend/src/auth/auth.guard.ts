import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { CHAVE_ADMIN, CHAVE_PUBLICA, type RequestWithUser } from './current-user';

/**
 * Guard global: toda rota exige sessao, a menos que marque @Public().
 *
 * O ponto do desenho e falhar fechado — rota nova que alguem esqueceu de
 * proteger nasce protegida. O guard anterior fazia o oposto: lia
 * `x-user-email`, criava a conta e nunca rejeitava, entao qualquer um virava
 * qualquer um mandando um header.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (publica) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = String(request.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('Entre para continuar.');
    }

    const user = await this.auth.verificar(token);
    request.user = user;

    const soAdmin = this.reflector.getAllAndOverride<boolean>(CHAVE_ADMIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (soAdmin && user.role !== 'ADMIN') {
      throw new ForbiddenException('Esta acao e restrita a administradores.');
    }

    return true;
  }
}
