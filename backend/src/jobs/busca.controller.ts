import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BuscaService } from './busca.service';
import { RecursosService } from '../settings/recursos.service';
import { FiltrosDto } from './job.dto';

/**
 * A busca ao vivo, disparada pelo botao Filter.
 *
 * SSE e nao JSON de uma vez: a busca leva ~1 minuto, e a vaga tem de aparecer
 * na tela quando fica pronta. Um POST comum devolveria tudo no fim, e a pessoa
 * encararia tela parada.
 *
 * POST porque os filtros vao no corpo — e o EventSource do navegador so faz
 * GET, entao a tela le com fetch + ReadableStream.
 */
@Controller('jobs/search')
export class BuscaController {
  constructor(
    private readonly busca: BuscaService,
    private readonly recursos: RecursosService,
  ) {}

  @Post()
  async buscar(@Body() filtros: FiltrosDto, @Res() res: Response): Promise<void> {
    // O interruptor e checado AQUI, nao so na tela: recurso desligado que a API
    // ainda aceita nao esta desligado, esta escondido — e cada busca gasta
    // credito da conta do admin.
    const { buscaVagasAtiva } = await this.recursos.obter();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Cinto e suspensorio junto do nginx: alguns proxies so respeitam este.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const enviar = (dado: unknown): void => {
      res.write(`data: ${JSON.stringify(dado)}\n\n`);
    };

    if (!buscaVagasAtiva) {
      enviar({ tipo: 'erro', mensagem: 'Job search is turned off. Ask an admin to enable it in Settings.' });
      res.end();
      return;
    }

    // Se a pessoa fecha a aba, para de gastar credito.
    let abortado = false;
    res.on('close', () => {
      abortado = true;
    });

    try {
      for await (const evento of this.busca.buscar(filtros)) {
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
