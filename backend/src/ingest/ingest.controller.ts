import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TokenDeIngestao } from '../auth/current-user';
import { ExigirJsonGuard } from './exigir-json.guard';
import { IngestService } from './ingest.service';
import { LoteDeIngestaoDto, type ResultadoDaIngestaoDto } from './ingest.dto';

/**
 * A porta de entrada do rastreador (JOB-50).
 *
 * ⚠️ **`@TokenDeIngestao()` e nao `@Public()`.** As duas diferencas que
 * importam, e que o `fail-closed.e2e.spec.ts` cobre:
 *
 * - `@Public()` faria o guard retornar `true` **inclusive com
 *   `AUTH_DISABLED=true`**, e esta rota ESCREVE no banco. O decorador proprio
 *   e verificado antes do desvio de `AUTH_DISABLED`, entao o 401 vale no modo
 *   aberto tambem;
 * - a rota continua fora das listas de "responde a quem nao entrou", entao o
 *   piso daquela suite — *toda rota protegida responde 401 ao anonimo* —
 *   continua valendo sobre ela, sem excecao nomeada.
 *
 * **Nao ha `@CurrentUser()` em handler nenhum daqui**, e nao poderia haver: o
 * rastreador e um processo, nao uma pessoa, e a vaga rastreada nao tem dono.
 */
/**
 * ⚠️ **O `@UseGuards()` daqui e a UNICA excecao do projeto, e nao afrouxa
 * nada** (JOB-54).
 *
 * O CLAUDE.md diz que nao ha `@UseGuards()` em controller nenhum, e a razao e
 * boa: guard de controller roda **depois** do guard global, entao usa-lo para
 * AUTORIZAR deixaria a rota passando pelo global primeiro — foi exatamente por
 * isso que o JOB-50 recusou esse caminho para o token.
 *
 * Este guard nao autoriza: ele confere o `Content-Type`. Rodar depois do
 * `AuthGuard` e o que se QUER aqui — quem nao tem o segredo leva 401 e nao
 * descobre nada sobre o formato aceito. A regra do CLAUDE.md protege o fail
 * closed, e um guard que so olha header de formato nao tem como abrir porta:
 * seu unico desfecho possivel e 415 ou "segue".
 */
@Controller('ingest')
@TokenDeIngestao()
@UseGuards(ExigirJsonGuard)
export class IngestController {
  constructor(private readonly ingest: IngestService) {}

  /**
   * Recebe um lote: `upsert`, `confirmar`, `fechar`.
   *
   * A resposta diz quantos de cada foram aplicados — e com ela que o
   * rastreador tira os itens da fila (JOB-49, decisao 9).
   */
  @Post('jobs')
  receber(@Body() body: LoteDeIngestaoDto): Promise<ResultadoDaIngestaoDto> {
    return this.ingest.aplicar(body);
  }
}
