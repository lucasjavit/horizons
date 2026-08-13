import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

/** Usuario ja resolvido pelo AuthGuard e anexado a request. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}

/**
 * Rotas que precisam funcionar antes de existir sessao (login, health).
 *
 * O guard e global, entao rota nova nasce protegida: esquecer o decorator
 * fecha o acesso em vez de abrir. Foi a melhor decisao do arguicao e a razao
 * de portar o padrao inteiro.
 */
export const CHAVE_PUBLICA = 'auth:publica';
export const Public = () => SetMetadata(CHAVE_PUBLICA, true);

/** Rotas que so administrador chama. */
export const CHAVE_ADMIN = 'auth:admin';
export const AdminOnly = () => SetMetadata(CHAVE_ADMIN, true);

/** Injeta o usuario da sessao no parametro do handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new Error('AuthGuard nao rodou antes deste handler');
    }
    return request.user;
  },
);
