/**
 * Recusa o lote que nao vem como JSON (JOB-54, defeito 3).
 *
 * ## O que estava acontecendo
 *
 * `app.useBodyParser('json', …)` so parseia `application/json`. Com qualquer
 * outro tipo o corpo chegava `{}`, o DTO aceitava (as tres listas sao
 * `@IsOptional`) e o servico aplicava tres listas vazias. Medido em 06/10/2026:
 *
 * ```
 * Content-Type: text/plain  + lote valido de 1 vaga
 *   -> 201 {"gravadas":0,"confirmadas":0,"fechadas":0}   e ZERO linhas
 * ```
 *
 * **Perda silenciosa, e do pior tipo.** O rastreador tira os itens da fila pela
 * resposta (JOB-49, decisao 9): um 201 significa "recebi", e quem olha so o
 * status HTTP descarta o lote que nunca entrou. O atenuante e que os contadores
 * vem `0` — um cliente que confira `gravadas == upsert.length` detecta —, mas
 * depender de o outro lado conferir nao e contrato, e sorte.
 *
 * ## Por que 415 e nao 400
 *
 * 415 e o codigo que existe para isso (*Unsupported Media Type*), e diz ao
 * rastreador exatamente o que corrigir: o header, nao o corpo. Um 400 mandaria
 * ele procurar erro de validacao num lote que esta correto.
 *
 * ## Por que um guard, e nao uma checagem no handler
 *
 * Guard roda antes do `ValidationPipe`. No handler, um corpo mal formado com
 * `Content-Type` errado passaria primeiro pela validacao e poderia sair como
 * 400 antes de alguem olhar o tipo — a resposta apontaria o campo errado.
 *
 * **Ordem importa:** no controller este guard vem DEPOIS do `@TokenDeIngestao()`
 * (que e verificado no `AuthGuard` global, e global roda primeiro). Quem nao
 * tem o segredo leva 401 sem descobrir nada sobre o formato aceito.
 */
import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Os tipos que o body parser de JSON realmente atende.
 *
 * **`application/json; charset=utf-8` e `application/JSON` funcionam hoje e
 * tem de continuar funcionando** — os dois foram medidos no card. Daí a
 * comparacao ser sobre o tipo **sem os parametros** e em caixa baixa, e nao um
 * `=== 'application/json'`, que quebraria o primeiro cliente que manda charset
 * (e e o que `axios` e `curl -d` mandam).
 *
 * `application/*+json` entra porque e a convencao do RFC 6839 para dialeto de
 * JSON (`application/merge-patch+json`), e o parser do Express tambem o aceita
 * por padrao — recusar aqui o que o parser aceita criaria um 415 sobre um corpo
 * que chegou parseado.
 */
function ehJson(tipo: string): boolean {
  const limpo = tipo.split(';')[0].trim().toLowerCase();
  return limpo === 'application/json' || /^application\/[\w.+-]+\+json$/.test(limpo);
}

@Injectable()
export class ExigirJsonGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const tipo = String(request.headers['content-type'] ?? '');

    // Corpo ausente de propósito (`Content-Length: 0`, sem header nenhum) nao e
    // tipo errado: e o lote vazio, que o card manda aceitar com zeros — "o
    // rastreador pode ter uma rodada em que nada mudou". Um 415 aqui faria ele
    // tratar "nada a fazer" como erro e reenviar para sempre.
    if (tipo === '') return true;

    if (!ehJson(tipo)) {
      throw new UnsupportedMediaTypeException(
        'O lote de ingestao precisa ser enviado como application/json.',
      );
    }
    return true;
  }
}
