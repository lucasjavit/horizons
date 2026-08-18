import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ApiProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decifrar } from '../settings/crypto';
import {
  INSTRUCAO_BUSCA,
  SCHEMA_BUSCA,
  descreverPedido,
  normalizar,
} from './busca-ia.comum';
import type { FiltrosDto, VagaDto } from './job.dto';
import type { IaDaBusca } from '../settings/recursos.service';

/**
 * A busca de vagas pela IA, sem Firecrawl — com Claude ou com ChatGPT.
 *
 * **A IA nao sabe vaga de cabeca — ela precisa procurar.** Medido em
 * 18/08/2026: perguntado por vagas abertas sem acesso a web, o modelo acertou
 * as cinco empresas (Dash0, Oscilar, Kadmos, Moniepoint, Pinterest) e nao
 * soube UMA vaga. Nem titulo, nem salario, nem URL. As palavras dele: "IDs de
 * vaga em Greenhouse/Lever/Ashby sao opacos e nao memorizaveis; eu produziria
 * uma URL bem formada que da 404".
 *
 * Por isso os dois caminhos usam busca na web de verdade — `web_search` na
 * Anthropic, `web_search` na Responses API da OpenAI. O que muda e a forma da
 * chamada; o que se pede, a instrucao e as defesas sao os mesmos, e moram em
 * `busca-ia.comum.ts` para nao divergirem.
 */
@Injectable()
export class BuscaIaService {
  private readonly log = new Logger(BuscaIaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ha chave de algum provedor? E o que decide se este motor existe. */
  async disponivel(): Promise<boolean> {
    const [a, o] = await Promise.all([
      this.chave(ApiProvider.ANTHROPIC),
      this.chave(ApiProvider.OPENAI),
    ]);
    return a !== null || o !== null;
  }

  /**
   * Busca com a IA escolhida, caindo na outra se a escolhida nao tem chave.
   *
   * O `qual` vem da configuracao (`iaEfetiva`), mas a checagem se repete aqui:
   * o servico nao pode depender de quem o chama ter feito a conta certa.
   */
  async buscar(
    filtros: FiltrosDto,
    consulta: string,
    qual: IaDaBusca,
  ): Promise<VagaDto[]> {
    const preferida = qual === 'openai' ? ApiProvider.OPENAI : ApiProvider.ANTHROPIC;
    const outra = qual === 'openai' ? ApiProvider.ANTHROPIC : ApiProvider.OPENAI;

    const chavePref = await this.chave(preferida);
    if (chavePref) {
      return preferida === ApiProvider.OPENAI
        ? this.comOpenAi(chavePref, filtros, consulta)
        : this.comAnthropic(chavePref, filtros, consulta);
    }

    const chaveOutra = await this.chave(outra);
    if (!chaveOutra) return [];
    this.log.log(
      `${preferida} sem chave — buscando com ${outra}`,
    );
    return outra === ApiProvider.OPENAI
      ? this.comOpenAi(chaveOutra, filtros, consulta)
      : this.comAnthropic(chaveOutra, filtros, consulta);
  }

  private async comAnthropic(
    chave: string,
    filtros: FiltrosDto,
    consulta: string,
  ): Promise<VagaDto[]> {
    const client = new Anthropic({ apiKey: chave });
    try {
      const resposta = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 8000,
        system: INSTRUCAO_BUSCA,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA_BUSCA } },
        messages: [{ role: 'user', content: descreverPedido(filtros, consulta) }],
      });

      // Refusal e 200 com content vazio: ler content[0] direto quebraria aqui.
      if (resposta.stop_reason === 'refusal') {
        this.log.warn('busca por IA recusada pelo modelo');
        return [];
      }
      const bloco = resposta.content.find((b) => b.type === 'text');
      if (!bloco || bloco.type !== 'text') return [];
      return this.ler(bloco.text);
    } catch (e) {
      this.log.error(`busca com Anthropic falhou: ${String(e).slice(0, 300)}`);
      return [];
    }
  }

  /**
   * O caminho da OpenAI.
   *
   * A API e outra: `responses.create` em vez de `messages.create`, `text.format`
   * em vez de `output_config`, e o resultado sai em `output_text` em vez de um
   * bloco de conteudo.
   */
  private async comOpenAi(
    chave: string,
    filtros: FiltrosDto,
    consulta: string,
  ): Promise<VagaDto[]> {
    const client = new OpenAI({ apiKey: chave });
    try {
      const resposta = await client.responses.create({
        model: 'gpt-5.6',
        tools: [{ type: 'web_search' }],
        input: [
          { role: 'system', content: INSTRUCAO_BUSCA },
          { role: 'user', content: descreverPedido(filtros, consulta) },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'vagas',
            schema: SCHEMA_BUSCA as unknown as Record<string, unknown>,
          },
        },
      });
      return this.ler(resposta.output_text ?? '');
    } catch (e) {
      this.log.error(`busca com OpenAI falhou: ${String(e).slice(0, 300)}`);
      return [];
    }
  }

  /** O JSON vira vaga, com as defesas do JOB-09 e JOB-10 aplicadas. */
  private ler(bruto: string): VagaDto[] {
    if (!bruto.trim()) return [];
    let lido: { vagas?: Record<string, unknown>[] };
    try {
      lido = JSON.parse(bruto) as { vagas?: Record<string, unknown>[] };
    } catch {
      this.log.warn('resposta da IA nao era JSON valido');
      return [];
    }
    return (lido.vagas ?? [])
      .map((v) => normalizar(v))
      .filter((v): v is VagaDto => v !== null);
  }

  private async chave(provider: ApiProvider): Promise<string | null> {
    const env =
      provider === ApiProvider.ANTHROPIC
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;
    if (env) return env;

    const guardado = await this.prisma.apiToken.findFirst({
      where: { provider },
      select: { secret: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!guardado) return null;
    try {
      return decifrar(guardado.secret);
    } catch {
      this.log.error(`token ${provider} nao pode ser decifrado`);
      return null;
    }
  }
}
