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
 * Rotas que o MANAGER tambem alcanca — e mais ninguem alem dele e do ADMIN.
 *
 * O corte do PLT-09, em uma frase: **Manager opera, Admin configura.** Ver a
 * lista de usuarios e desligar uma conta abusiva e operar; mudar o papel de
 * alguem e configurar, e continua `@AdminOnly()`.
 *
 * **Nao substitui `@AdminOnly()`, soma-se a ele.** Um handler que marque os
 * dois exige ADMIN, porque a checagem mais restritiva roda primeiro no guard —
 * marcar os dois nao faz sentido, mas nao abre nada.
 */
export const CHAVE_GESTAO = 'auth:gestao';
export const ManagerOrAdmin = () => SetMetadata(CHAVE_GESTAO, true);

/** Os papeis que existem (PLT-09). O banco guarda a string crua. */
export const PAPEIS = ['COMMON_USER', 'MANAGER', 'ADMIN'] as const;

/**
 * Rotas que funcionam com ou sem sessao.
 *
 * Diferente de `@Public()`: aqui o token, **se vier**, ainda e verificado e o
 * usuario resolvido. E o que permite a mesma rota servir a leitura anonima e,
 * para quem entrou, devolver o que e dela junto — sem duplicar endpoint.
 *
 * Token invalido continua sendo erro. Aceitar em silencio esconderia sessao
 * expirada: a pessoa veria a tela vazia achando que perdeu o que guardou.
 *
 * Depois do PLT-13 (01/10) sobrou **uma** rota assim, `POST /jobs/facets` —
 * as quatro de `tracks` sairam com as trilhas. O decorador continua valendo
 * para a proxima.
 */
export const CHAVE_OPCIONAL = 'auth:opcional';
export const SessaoOpcional = () => SetMetadata(CHAVE_OPCIONAL, true);

/**
 * Rotas que **outra aplicacao** chama, com segredo proprio (`INGEST_TOKEN`).
 *
 * Hoje so a ingestao de vagas rastreadas (JOB-50): o rastreador e um processo,
 * nao uma pessoa, e nao tem sessao do Google para trocar por um JWT.
 *
 * ## Por que nao `@Public()` + checagem no handler
 *
 * Duas razoes, e as duas foram o que decidiu o desenho:
 *
 * 1. **`@AUTH_DISABLED=true` desliga o `@Public()` junto.** O guard retorna
 *    antes de olhar qualquer coisa, entao a checagem no handler seria a unica
 *    protecao de uma rota que ESCREVE no banco — e com o login desligado nao
 *    sobraria nenhuma camada antes dela. Aqui a checagem roda DENTRO do guard,
 *    e **antes** do desvio de `AUTH_DISABLED`, que e o que faz o 401 valer
 *    tambem no modo aberto.
 * 2. **O `ValidationPipe` roda depois do guard, nunca antes.** No handler, um
 *    corpo invalido sem token responderia 400 — e o `fail-closed.e2e.spec.ts`
 *    percorre as rotas registradas exigindo 401 do anonimo. Um 400 ali e
 *    indistinguivel de "o pipe correu antes do guard", que e vazamento.
 *
 * ## E por que nao e `@Public()` nem `@SessaoOpcional()`
 *
 * As duas listas do `fail-closed.e2e.spec.ts` significam "responde a quem nao
 * entrou". Esta rota **nao** responde a quem nao entrou: ela responde a quem
 * tem o segredo. Entao ela fica fora das duas e cai no piso — *toda rota
 * protegida responde 401 ao anonimo* —, que e exatamente a garantia que se
 * quer. Nao ha excecao nomeada a manter.
 */
export const CHAVE_INGESTAO = 'auth:ingestao';
export const TokenDeIngestao = () => SetMetadata(CHAVE_INGESTAO, true);

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
