import { Injectable, Logger } from '@nestjs/common';
import { CadeiaEsgotada, IaService, RecusaDoModelo } from '../ia/ia.service';
import { provedor } from '../ia/provedores';
import {
  INSTRUCAO_BUSCA,
  SCHEMA_BUSCA,
  descreverPedido,
  normalizar,
} from './busca-ia.comum';
import type { FiltrosDto, VagaDto } from './job.dto';
import type { IaDaBusca } from '../settings/recursos.service';

/**
 * Falha do provedor, distinta de "nao achei nada".
 *
 * Sem isto o `catch` devolvia `[]`, e a tela dizia "0 vagas" quando o que
 * houve foi 429 por falta de credito (aconteceu em 21/08 com a chave da
 * OpenAI). A pessoa conclui que nao existe vaga de Java na LATAM — o que e
 * falso, e e a conclusao mais cara que este produto pode induzir.
 */
export class FalhaDaIa extends Error {
  constructor(
    readonly provedor: string,
    readonly detalhe: string,
  ) {
    super(`busca com ${provedor} falhou: ${detalhe}`);
    this.name = 'FalhaDaIa';
  }
}

/**
 * A busca de vagas pela IA, sem Firecrawl.
 *
 * **A IA nao sabe vaga de cabeca — ela precisa procurar.** Medido em
 * 18/08/2026: perguntado por vagas abertas sem acesso a web, o modelo acertou
 * as cinco empresas (Dash0, Oscilar, Kadmos, Moniepoint, Pinterest) e nao
 * soube UMA vaga. Nem titulo, nem salario, nem URL. As palavras dele: "IDs de
 * vaga em Greenhouse/Lever/Ashby sao opacos e nao memorizaveis; eu produziria
 * uma URL bem formada que da 404".
 *
 * Por isso este motor pede a capacidade `buscaWeb`, e **so provedores que a
 * tem entram na cadeia**: Anthropic, OpenAI e Gemini. Groq, Cerebras e Mistral
 * ficam de fora — nao porque falhariam, mas porque teriam SUCESSO produzindo
 * exatamente as URLs que dao 404.
 *
 * A queda entre provedores mora no `IaService`, e desde 25/08/2026 ela vale
 * tambem para chave PRESENTE e RECUSADA — era a divida registrada no JOB-02:
 * este servico caia so por AUSENCIA de chave, e um 401 do primeiro provedor
 * subia direto para a tela com um provedor saudavel cadastrado ao lado.
 */
@Injectable()
export class BuscaIaService {
  private readonly log = new Logger(BuscaIaService.name);

  constructor(private readonly ia: IaService) {}

  /** Ha provedor com busca na web e chave? E o que decide se este motor existe. */
  disponivel(): Promise<boolean> {
    return this.ia.disponivel('buscaWeb');
  }

  /**
   * Busca com a cadeia de provedores que sabem procurar na web.
   *
   * `ordem` e a lista completa como o admin a arrumou: quem responde primeiro
   * atende, e um provedor que recusa a chave passa a vez em vez de derrubar a
   * busca.
   */
  async buscar(
    filtros: FiltrosDto,
    consulta: string,
    ordem: readonly IaDaBusca[],
  ): Promise<VagaDto[]> {
    let bruto: string;
    try {
      bruto = await this.ia.pedir('buscaWeb', ordem, {
        instrucao: INSTRUCAO_BUSCA,
        entrada: descreverPedido(filtros, consulta),
        schema: SCHEMA_BUSCA as unknown as Record<string, unknown>,
        nomeDoSchema: 'vagas',
        maxTokens: 8000,
        buscaWeb: true,
      });
    } catch (e) {
      // Recusa do modelo nao e falha de infraestrutura: nao ha vaga a mostrar,
      // mas tambem nao ha erro a reportar. Continua devolvendo lista vazia,
      // como antes.
      if (e instanceof RecusaDoModelo) {
        this.log.warn('busca por IA recusada pelo modelo');
        return [];
      }
      if (e instanceof CadeiaEsgotada) {
        // Sem NENHUM provedor com chave, isto nao e falha — e ausencia de
        // motor, e quem chama ja tratou (`disponivel()`). Devolver `[]` aqui
        // preserva o comportamento antigo para esse caso.
        const houveTentativa = e.tentativas.some((t) => t.motivo !== 'sem chave');
        if (!houveTentativa) {
          this.log.log('nenhum provedor de busca com chave cadastrada');
          return [];
        }
        this.log.error(e.message);
        // O nome mostrado e o do primeiro que de fato falhou; se nenhum
        // chegou a ser tentado, o do topo da cadeia — e o que a pessoa
        // reconhece na tela de Configuracoes.
        const primeiraFalha = e.tentativas.find((t) => t.motivo !== 'sem chave');
        throw new FalhaDaIa(
          primeiraFalha?.provedor ?? nomeDe(ordem[0] ?? null),
          e.tentativas.map((t) => `${t.provedor}: ${t.motivo}`).join('; '),
        );
      }
      throw e;
    }

    return this.ler(bruto);
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
}

/** Nome legivel de um provedor, para a mensagem que chega a tela. */
function nomeDe(id: IaDaBusca | null): string {
  if (!id) return 'AI';
  return provedor(id)?.nome ?? String(id);
}
