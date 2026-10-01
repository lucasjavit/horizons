import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BuscaService } from './busca.service';
import { RecursosService } from '../settings/recursos.service';
import { CurrentUser, SessaoOpcional } from '../auth/current-user';
import type { AuthUser } from '../auth/current-user';
import { FiltrosDto, MaisVagasPedidoDto } from './job.dto';
import type { MaisVagasDto } from './busca.service';
import { limitesDe } from './limites-anonimos';

/**
 * A busca ao vivo, disparada pelo botao Filter.
 *
 * SSE e nao JSON de uma vez: a busca leva ~1 minuto, e a vaga tem de aparecer
 * na tela quando fica pronta. Um POST comum devolveria tudo no fim, e a pessoa
 * encararia tela parada.
 *
 * POST porque os filtros vao no corpo — e o EventSource do navegador so faz
 * GET, entao a tela le com fetch + ReadableStream.
 *
 * ## As duas rotas sao `@SessaoOpcional()`, e nao `@Public()` (JOB-47)
 *
 * A busca funciona sem login desde 01/10/2026 — decisao do stakeholder: *"nao
 * precisa de login para fazer buscas"*. O que o anonimo alcanca e menos, e o
 * `limites-anonimos.ts` diz exatamente o que.
 *
 * **A escolha do decorador e o coracao do card, e `@Public()` seria errado.**
 * Numa rota opcional o token, *se vier*, ainda e verificado: token invalido
 * continua dando 401 em vez de virar anonimo em silencio. A diferenca aparece
 * na sessao expirada — com `@Public()` ela viraria uma busca que devolve a
 * amostra de 14 dias, e a pessoa concluiria que o produto perdeu metade do
 * acervo em vez de que ela precisa entrar de novo. Ver CLAUDE.md.
 */
@Controller('jobs/search')
export class BuscaController {
  constructor(
    private readonly busca: BuscaService,
    private readonly recursos: RecursosService,
  ) {}

  /**
   * A proxima pagina de uma busca ja aberta (JOB-45).
   *
   * **JSON de uma vez, e nao SSE — ao contrario do irmao logo abaixo.** O
   * stream existe porque a primeira varredura leva de 2s a ~60s, e tela parada
   * por um minuto parece travamento. Isto e UMA chamada ao freehire, ~1,5s:
   * streaming so acrescentaria conexao aberta e um segundo caminho de leitura
   * na tela, sem nada para mostrar no meio.
   *
   * Rota especifica ANTES da generica — `search/mais` viria depois de
   * `search` se a ordem fosse outra, e o `@Post()` sem caminho engoliria.
   */
  /**
   * **Sem `@CurrentUser()` aqui, e e de proposito** (JOB-47).
   *
   * Os limites da pagina 2 saem da SESSAO, que os gravou na pagina 1 — nao de
   * quem esta pedindo agora. Ler o usuario aqui seria pior do que inutil:
   * daria a impressao de que a restricao e reavaliada, quando o que protege e
   * justamente ela nao ser (o corpo manda so o id, entao nao ha o que
   * falsificar).
   *
   * O `@SessaoOpcional()` continua necessario: sem ele o guard fecha a rota, e
   * o anonimo que buscou na pagina 1 levaria 401 ao clicar em "Load more".
   */
  @Post('mais')
  @SessaoOpcional()
  mais(@Body() body: MaisVagasPedidoDto): Promise<MaisVagasDto> {
    return this.busca.mais(body.sessao);
  }

  @Post()
  @SessaoOpcional()
  async buscar(
    @Body() filtros: FiltrosDto,
    @Res() res: Response,
    // `null` quando ninguem entrou — e o que `@SessaoOpcional()` permite. O
    // handler trata, como manda o CLAUDE.md.
    @CurrentUser() usuario: AuthUser | null,
  ): Promise<void> {
    // Checado AQUI, e nao so na tela: recurso desligado que a API ainda aceita
    // nao esta desligado, esta escondido — e cada busca gasta credito.
    //
    // O que se checa e se EXISTE MOTOR, e nao se o Firecrawl esta ligado. O
    // interruptor do Firecrawl escolhe o motor; desliga-lo passa a vez para a
    // IA em vez de fechar a busca.
    const { buscaPossivel } = await this.recursos.obter();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Cinto e suspensorio junto do nginx: alguns proxies so respeitam este.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const enviar = (dado: unknown): void => {
      res.write(`data: ${JSON.stringify(dado)}\n\n`);
    };

    if (!buscaPossivel) {
      enviar({
        tipo: 'erro',
        // A mensagem cita as FAMILIAS, nao os provedores: eram dois quando
        // ela foi escrita e hoje sao seis (JOB-33), e uma lista de nomes aqui
        // envelhece a cada provedor novo (QA, 25/08).
        mensagem:
          'Job search needs a source. Ask an admin to turn on the ATS search, ' +
          'or add an AI provider or Firecrawl key in Settings.',
      });
      res.end();
      return;
    }

    // Se a pessoa fecha a aba, para de gastar credito.
    let abortado = false;
    res.on('close', () => {
      abortado = true;
    });

    try {
      // **A traducao de "quem e" para "o que pode" acontece AQUI**, no unico
      // lugar que sabe se ha sessao. O servico recebe a politica pronta e nao
      // reimplementa nada a partir do usuario — ver `limites-anonimos.ts`.
      for await (const evento of this.busca.buscar(filtros, limitesDe(usuario))) {
        if (abortado) break;
        enviar(evento);
      }
    } catch (e) {
      enviar({ tipo: 'erro', mensagem: 'Search failed. Try again in a moment.' });
    } finally {
      res.end();
    }
  }
}
