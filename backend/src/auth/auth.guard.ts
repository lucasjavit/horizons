import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, authDesligada } from './auth.service';
import {
  CHAVE_ADMIN,
  CHAVE_OPCIONAL,
  CHAVE_PUBLICA,
  type RequestWithUser,
} from './current-user';

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

    // Login desligado (temporario): nenhuma rota exige token, e todo mundo
    // e a conta de desenvolvimento. Resolve o usuario do banco em vez de
    // deixar passar sem nada — os handlers usam @CurrentUser() e quebrariam.
    if (authDesligada()) {
      request.user = await this.auth.usuarioDeDesenvolvimento();
      // De proposito sem checar CHAVE_ADMIN: com o login desligado, exigir
      // papel deixaria a Configuracoes inacessivel justamente para quem
      // desligou o login para poder mexer nela.
      return true;
    }

    const opcional = this.reflector.getAllAndOverride<boolean>(CHAVE_OPCIONAL, [
      context.getHandler(),
      context.getClass(),
    ]);

    const header = String(request.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      // Sem token numa rota de sessao opcional: segue como anonimo. O handler
      // recebe `null` em @CurrentUser() e devolve a versao sem progresso.
      if (opcional) return true;
      throw new UnauthorizedException('Entre para continuar.');
    }

    // Token presente e sempre verificado, inclusive em rota opcional: aceitar
    // um token invalido em silencio faria a sessao expirada parecer trilha
    // zerada, e a pessoa acharia que perdeu o progresso.
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
