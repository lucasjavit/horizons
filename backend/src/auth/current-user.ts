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

/**
 * Rotas que funcionam com ou sem sessao.
 *
 * Diferente de `@Public()`: aqui o token, **se vier**, ainda e verificado e o
 * usuario resolvido. E o que permite a mesma rota servir a leitura anonima e,
 * para quem entrou, devolver o progresso junto — sem duplicar endpoint.
 *
 * Token invalido continua sendo erro. Aceitar em silencio esconderia sessao
 * expirada: a pessoa veria a trilha zerada achando que perdeu o progresso.
 */
export const CHAVE_OPCIONAL = 'auth:opcional';
export const SessaoOpcional = () => SetMetadata(CHAVE_OPCIONAL, true);

/**
 * Injeta o usuario da sessao no parametro do handler.
 *
 * Em rota `@SessaoOpcional()` pode ser `null` — o handler precisa tratar. Em
 * rota protegida nunca e, porque o guard ja teria rejeitado antes.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user ?? null;
  },
);
