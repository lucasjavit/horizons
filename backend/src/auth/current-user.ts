import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Usuario ja resolvido pelo CurrentUserGuard e anexado a request. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface RequestWithUser extends Request {
  user?: AuthUser;
}

/**
 * Injeta o usuario resolvido pelo guard.
 * Quando trocarmos o header por JWT, so o guard muda — os controllers seguem
 * iguais.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new Error('CurrentUserGuard nao rodou antes deste handler');
    }
    return request.user;
  },
);
