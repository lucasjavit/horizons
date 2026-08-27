import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { chaveDoCache } from './cache-de-busca';
import type { FiltrosDto, VagaDto } from './job.dto';

/**
 * O cache de 10 minutos que sustenta a paginacao sob demanda (JOB-45).
 *
 * **Por que a memoria do processo, e nao o Postgres.**
 *
 * O que se guarda aqui e efemero por natureza: o offset alcancado e as URLs ja
 * entregues numa sessao de busca. Vive 10 minutos, e o custo de perder e uma
 * vaga repetida que ninguem nota. O Postgres custaria migration, tabela,
 * indice, rotina de limpeza e um round-trip por pagina — para um dado que morre
 * antes do proximo deploy. Nao paga.
 *
 * **O que isso significa em producao.** O `docker-compose.prod.yml` existe, e
 * com varias instancias sem sticky session a pagina 2 pode cair noutra
 * instancia, que nao conhece a sessao e responde `expirada`. A tela trata isso
 * refazendo a busca do zero: o pior caso e a pessoa reveer a pagina 1, e nao um
 * erro nem uma tela vazia. Se um dia isso incomodar, o lugar de mexer e aqui —
 * a interface do servico ja e assincrona de proposito, entao trocar o Map por
 * Redis nao mexe em quem chama.
 */

/** Quanto uma sessao sobrevive sem ser tocada. O pedido do stakeholder. */
const TTL_MS = 10 * 60 * 1000;

/**
 * O teto NOSSO de vagas por sessao — 5 chamadas de 60.
 *
 * O `meta.total` da API diz 49.859 num filtro de LATAM, e chegou a 400.054 no
 * log que abriu o card. Esse numero e o TAMANHO DO FILTRO, e nao a meta:
 * paginar ate o fim seriam 6.600 chamadas a um servico de terceiro, gratis e
 * sem SLA, cujo orcamento publicado e 300 req/min.
 *
 * 300 vagas sao 12 paginas de 25 na tela. Quem chega a decima segunda pagina de
 * uma busca de vagas ja refinou o filtro ou desistiu — o teto nao e o que
 * limita essa pessoa.
 *
 * E o teto se ANUNCIA como nosso: a tela diz "showing the first 300 matches",
 * nao "acabou". Dizer que acabou com 49 mil no filtro seria mentira.
 */
const TETO_DE_VAGAS = 300;

/**
 * Quantas sessoes o processo guarda ao mesmo tempo.
 *
 * Um Map sem teto e um vazamento com passos de reproducao: basta gente
 * buscando. 200 sessoes de ate 300 vagas e o pior caso que o processo carrega
 * sem apertar, e a mais velha sai quando a 201 entra.
 */
const MAX_SESSOES = 200;

/** De onde as vagas desta sessao vieram. So o freehire sabe pedir mais. */
export type MotorDaSessao = 'freehire' | 'ats' | 'ia' | 'firecrawl';

/** Uma sessao de busca viva, com o que ja foi entregue e onde parou. */
interface Sessao {
  /** A assinatura dos filtros. Filtro diferente, sessao diferente. */
  chave: string;
  motor: MotorDaSessao;
  filtros: FiltrosDto;
  /** Onde a proxima chamada a API comeca. */
  offset: number;
  /**
   * As URLs ja entregues, para o dedup atravessar as paginas.
   *
   * **Por URL e nao por `id`**: o `id` da vaga do freehire e o `public_slug`, e
   * a mesma vaga republicada por dois agregadores tem slug diferente com a
   * mesma URL. Deduplicar por slug deixaria a duplicata passar.
   */
  entregues: Set<string>;
  /** Quantas ja foram para a tela. Conta contra o `TETO_DE_VAGAS`. */
  quantas: number;
  /**
   * O `meta.total` do filtro, quando a API o informou.
   *
   * **NAO confie nele como "quantas existem" quando ha busca textual.** Medido
   * em 27/08/2026: `countries=uy&q=Backend&limit=60` devolve `total: 60` — o
   * tamanho da PAGINA, e nao o do filtro. Sem `q`, o mesmo filtro diz 505.
   *
   * Isso nao quebra a paginacao, e por sorte na direcao segura: o `offset=60`
   * daquela consulta devolveu ZERO linhas, entao o filtro tinha mesmo 60 e
   * parar ali estava certo. Mas se um dia o numero for usado para outra coisa
   * — "mostrando 60 de N" na tela, por exemplo —, ele mentiria.
   */
  totalNoFiltro: number | null;
  /** Nao ha mais o que pedir: teto alcancado, filtro esgotado ou motor sem paginacao. */
  esgotada: boolean;
  expiraEm: number;
}

/** O que `abrir` devolve a quem esta montando a resposta da busca. */
export interface SessaoAberta {
  id: string;
  temMais: boolean;
}

/** O resultado de pedir mais uma pagina. */
export interface MaisVagas {
  vagas: VagaDto[];
  temMais: boolean;
  /**
   * Por que acabou, quando acabou. A tela diz coisas diferentes para cada um.
   *
   * `teto` e o nosso limite e pede refinar o filtro; `fim` e o filtro acabar de
   * verdade. Confundir os dois faria a tela dizer "sao todas as 300" quando ha
   * 49 mil.
   */
  motivo: 'teto' | 'fim' | null;
  /** Quantas ja foram entregues nesta sessao, somando todas as paginas. */
  entregues: number;
  totalNoFiltro: number | null;
}

@Injectable()
export class SessaoDeBuscaService {
  private readonly log = new Logger(SessaoDeBuscaService.name);
  private readonly sessoes = new Map<string, Sessao>();

  /**
   * Abre a sessao de uma busca que acabou de rodar.
   *
   * **A sessao de um motor que nao pagina nasce esgotada**, e isso e o que faz
   * o ATS e a IA continuarem inteiros. A busca e uma CASCATA que para no
   * primeiro motor que acha algo (ver `busca.service.ts`), entao quando o ATS
   * responde ele ja entregou tudo que tinha numa chamada so — nao ha offset a
   * pedir, e a tela nao mostra o botao.
   */
  abrir(
    motor: MotorDaSessao,
    filtros: FiltrosDto,
    vagas: VagaDto[],
    /**
     * Quantas linhas a API devolveu, ANTES do filtro local.
     *
     * **E por aqui que o offset comeca, e nao por `vagas.length`.** O
     * `peneirar` do motor corta por `exclude_keywords` e `locations`, que a API
     * deles nao sabe filtrar. Se a pagina 1 lesse 60 linhas e entregasse 12, um
     * offset de 12 faria a pagina 2 reler 48 linhas ja descartadas — para
     * descarta-las outra vez. A paginacao andaria 12 em 12 pelo mesmo trecho.
     */
    lidasDaApi: number,
    totalNoFiltro: number | null,
    /**
     * O interruptor `jobs.paginacao` esta ligado?
     *
     * **Separado do `motor` de proposito.** A tentacao e passar `'ats'` quando
     * a paginacao esta desligada, porque o efeito e o mesmo (sessao esgotada) —
     * mas ai a sessao MENTE sobre de onde as vagas vieram, e o proximo a ler um
     * log de depuracao acreditaria nela.
     */
    paginacaoAtiva: boolean,
  ): SessaoAberta {
    this.limpar();

    const id = randomUUID();
    const paginavel = motor === 'freehire' && paginacaoAtiva;
    // O filtro pode acabar na primeira pagina: 60 pedidas, 8 devolvidas quer
    // dizer que o catalogo tinha 8. Sem isto a tela ofereceria "Load more" para
    // uma sessao que so tem uma chamada vazia a devolver.
    const fimDoCatalogo =
      lidasDaApi === 0 ||
      (totalNoFiltro !== null && lidasDaApi >= totalNoFiltro);
    const sessao: Sessao = {
      chave: chaveDoCache(filtros),
      motor,
      filtros,
      offset: lidasDaApi,
      entregues: new Set(vagas.map((v) => v.url)),
      quantas: vagas.length,
      totalNoFiltro,
      // Motor sem paginacao esgota na abertura. O paginavel esgota se ja
      // entregou o teto de uma vez — hoje impossivel (60 < 300), mas o `>=`
      // evita que subir o `LIMITE` amanha crie uma sessao que pede a 301a.
      esgotada: !paginavel || fimDoCatalogo || vagas.length >= TETO_DE_VAGAS,
      expiraEm: Date.now() + TTL_MS,
    };
    this.sessoes.set(id, sessao);
    return { id, temMais: !sessao.esgotada };
  }

  /** Os filtros com que a sessao foi aberta, ou `null` se ela venceu. */
  filtrosDe(id: string): FiltrosDto | null {
    return this.viva(id)?.filtros ?? null;
  }

  /**
   * Registra o lote que o motor acabou de trazer e diz o que sobrou de novo.
   *
   * Quem chama e o `BuscaService`, que e quem fala com o motor — este servico
   * nao busca nada, so guarda. E a divisao que deixa trocar o Map por Redis sem
   * mexer no orquestrador.
   *
   * **`meta.total` e o teto competem, e vence o primeiro que chegar.** Se o
   * filtro so tem 80 vagas, a sessao esgota em 80 com motivo `fim`, e a tela
   * diz "That's all 80 jobs" — que e a verdade, e nao o nosso limite.
   */
  registrar(
    id: string,
    lote: VagaDto[],
    totalNoFiltro: number | null,
    /** Quantas linhas a API devolveu ANTES do nosso filtro local. */
    lidasDaApi: number,
  ): MaisVagas | null {
    const s = this.viva(id);
    if (!s) return null;

    if (totalNoFiltro !== null) s.totalNoFiltro = totalNoFiltro;

    // **O offset anda pelo que a API DEVOLVEU, e nao pelo que sobrou.**
    //
    // O `peneirar` do motor corta por `exclude_keywords` e `locations`, que a
    // API nao sabe filtrar. Andar o offset pelo que sobrou faria a proxima
    // chamada reler as linhas ja descartadas, para descarta-las de novo — um
    // laco que nunca chega ao fim do catalogo.
    s.offset += lidasDaApi;

    const novas: VagaDto[] = [];
    for (const v of lote) {
      if (s.entregues.has(v.url)) continue;
      if (s.quantas + novas.length >= TETO_DE_VAGAS) break;
      s.entregues.add(v.url);
      novas.push(v);
    }
    s.quantas += novas.length;

    // A API devolver menos do que o pedido e o fim do filtro: nao ha proxima
    // pagina para pedir. Zero linha tambem, e pelo mesmo motivo.
    const fimDoCatalogo =
      lidasDaApi === 0 ||
      (s.totalNoFiltro !== null && s.offset >= s.totalNoFiltro);
    const noTeto = s.quantas >= TETO_DE_VAGAS;

    let motivo: MaisVagas['motivo'] = null;
    if (noTeto) motivo = 'teto';
    else if (fimDoCatalogo) motivo = 'fim';

    s.esgotada = noTeto || fimDoCatalogo;
    // Tocar a sessao renova os 10 minutos: quem esta paginando esta usando, e
    // expirar no meio da leitura seria expirar justamente para quem a quer.
    s.expiraEm = Date.now() + TTL_MS;

    return {
      vagas: novas,
      temMais: !s.esgotada,
      motivo,
      entregues: s.quantas,
      totalNoFiltro: s.totalNoFiltro,
    };
  }

  /** Onde a proxima chamada comeca, ou `null` se a sessao morreu ou esgotou. */
  proximoOffset(id: string): number | null {
    const s = this.viva(id);
    if (!s || s.esgotada) return null;
    return s.offset;
  }

  /** Quantas ainda cabem antes do teto. Nunca negativo. */
  quantasFaltam(id: string): number {
    const s = this.viva(id);
    if (!s) return 0;
    return Math.max(0, TETO_DE_VAGAS - s.quantas);
  }

  /**
   * A sessao, se ainda vale. Vencida sai do Map na hora.
   *
   * Ler e o que expira, e nao um timer: um `setInterval` num servico de Nest
   * segura o processo vivo no shutdown, e uma sessao vencida que ninguem le nao
   * incomoda ninguem. O `limpar()` da abertura cuida do resto.
   */
  private viva(id: string): Sessao | null {
    const s = this.sessoes.get(id);
    if (!s) return null;
    if (s.expiraEm <= Date.now()) {
      this.sessoes.delete(id);
      return null;
    }
    return s;
  }

  /** Tira as vencidas e, se ainda estourar o teto, as mais velhas. */
  private limpar(): void {
    const agora = Date.now();
    for (const [id, s] of this.sessoes) {
      if (s.expiraEm <= agora) this.sessoes.delete(id);
    }
    // O Map do JS itera na ordem de insercao, entao a primeira e a mais antiga.
    while (this.sessoes.size >= MAX_SESSOES) {
      const maisVelha = this.sessoes.keys().next().value;
      if (maisVelha === undefined) break;
      this.sessoes.delete(maisVelha);
      this.log.warn(
        `cache de busca no teto de ${MAX_SESSOES} sessoes — a mais antiga saiu`,
      );
    }
  }
}
