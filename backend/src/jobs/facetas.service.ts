import { Injectable, Logger } from '@nestjs/common';
import type { FiltrosDto } from './job.dto';
import { paraConsultaFreehire, BASE_FREEHIRE, UA_FREEHIRE } from './freehire-consulta';

/**
 * As contagens que alimentam o modal de filtros (JOB-41).
 *
 * **O que este servico entrega e o numero ao lado de cada opcao** — o
 * `Backend 639` da referencia —, e o total do botao `Show N jobs`.
 *
 * Por que isso nao e enfeite: o catalogo de filtros de hoje e escrito a mao em
 * `vaga-filtro.ts` e nao sabe nada sobre o que existe. "Brazil" aparece igual
 * quando ha 16.780 vagas e quando ha zero, e a pessoa so descobre clicando. A
 * contagem inverte isso — a ausencia aparece ANTES do clique, que e a mesma
 * regra por tras de `filtro que nao filtra e pior que filtro ausente`.
 *
 * E a contagem e CONDICIONAL, medido em 26/08/2026:
 *
 * | Consulta                              | `countries.br` |
 * | ------------------------------------- | -------------: |
 * | sem filtro                            |        566.010 |
 * | `regions=latam`                       |     **16.780** |
 * | `regions=latam` + `q=software engineer` |    **2.850** |
 *
 * Ou seja: marcar LATAM muda o numero ao lado de Brazil. E por isso que a
 * tela nao pode calcular isso sozinha a partir das vagas que recebeu — ela
 * recebe 60, e a contagem fala de 16 mil.
 *
 * **Depende do freehire, e so dele.** Os outros motores devolvem titulo e
 * local; nao ha faceta a extrair deles. Quando o freehire esta fora, este
 * servico devolve `null` e a tela ESCONDE as categorias que ele sustentava —
 * ver `FacetasDto.disponivel`.
 */

/** Uma opcao dentro de uma categoria, com quantas vagas ela tem. */
export interface OpcaoFaceta {
  /** O valor canonico, como a API deles o escreve (`software_engineering`). */
  valor: string;
  /** Quantas vagas casam, com os OUTROS filtros ja aplicados. */
  total: number;
}

/**
 * O que a tela precisa para montar o modal.
 *
 * `disponivel: false` nao e erro — e a resposta honesta de "o motor que
 * sustenta isto esta fora". A tela encolhe em vez de mostrar categoria morta.
 */
export interface FacetasDto {
  /** Ha facetas agora? `false` esconde as categorias que dependem delas. */
  disponivel: boolean;
  /**
   * Quantas vagas a selecao atual devolve.
   *
   * E o numero do botao `Show N jobs`. `null` quando indisponivel — a tela
   * mostra `Show jobs` sem numero, em vez de um zero que mentiria.
   */
  total: number | null;
  /** As opcoes por faceta, ja ordenadas da mais numerosa para a menos. */
  facetas: Record<string, OpcaoFaceta[]>;
}

/**
 * Quantas opcoes devolver por faceta.
 *
 * `skills`, `cities` e `role` tem 1.200 valores cada. Mandar tudo seria ~200 KB
 * de JSON por abertura de modal, para uma lista que ninguem rola ate o fim. A
 * tela mostra as mais numerosas e tem busca para o resto — e a busca consulta
 * de novo, com `q`, em vez de filtrar no cliente uma lista truncada.
 */
const TETO_POR_FACETA = 40;

@Injectable()
export class FacetasService {
  private readonly log = new Logger(FacetasService.name);

  async obter(filtros: FiltrosDto): Promise<FacetasDto> {
    const params = paraConsultaFreehire(filtros);
    const resposta = await this.pedir(`/api/v1/jobs/facets?${params}`);
    if (!resposta) return { disponivel: false, total: null, facetas: {} };

    const dados = (resposta.data ?? {}) as { facets?: unknown };
    const brutas = dados.facets;
    if (!brutas || typeof brutas !== 'object') {
      return { disponivel: false, total: null, facetas: {} };
    }

    const facetas: Record<string, OpcaoFaceta[]> = {};
    for (const [nome, valores] of Object.entries(brutas as Record<string, unknown>)) {
      if (!valores || typeof valores !== 'object') continue;
      const opcoes: OpcaoFaceta[] = [];
      for (const [valor, total] of Object.entries(valores as Record<string, unknown>)) {
        if (typeof total !== 'number' || !Number.isFinite(total)) continue;
        opcoes.push({ valor, total });
      }
      // Da mais numerosa para a menos: a tela mostra as primeiras, e o que
      // interessa a quem filtra e onde ha vaga.
      opcoes.sort((a, b) => b.total - a.total);
      facetas[nome] = opcoes.slice(0, TETO_POR_FACETA);
    }

    // O total da selecao vem da BUSCA, e nao da soma das facetas: somar
    // `countries` daria mais que o total, porque uma vaga que aceita Brasil e
    // Mexico conta nos dois. O botao diria um numero maior que a lista.
    const total = await this.total(params);

    return { disponivel: true, total, facetas };
  }

  /**
   * Quantas vagas a selecao devolve — o `N` do botao.
   *
   * `limit=1` porque so o `meta.total` interessa; pedir 0 e recusado e pedir
   * 60 traria 60 anuncios para descartar.
   */
  private async total(params: string): Promise<number | null> {
    const r = await this.pedir(`/api/v1/jobs/search?${params}&limit=1`);
    const t = (r?.meta as { total?: unknown } | undefined)?.total;
    return typeof t === 'number' && Number.isFinite(t) ? t : null;
  }

  /**
   * GET no freehire, sem retry.
   *
   * **Diferente do motor de busca, que faz backoff em 429/5xx.** Aqui a
   * chamada acontece a cada clique no modal: insistir deixaria a interface
   * parada esperando um numero. Falhou, a tela esconde a contagem e continua
   * filtrando — o filtro funciona sem o numero, so fica menos informado.
   */
  private async pedir(
    caminho: string,
  ): Promise<{ data?: unknown; meta?: unknown } | null> {
    try {
      const r = await fetch(`${BASE_FREEHIRE}${caminho}`, {
        headers: { 'User-Agent': UA_FREEHIRE, Accept: 'application/json' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        this.log.warn(`facetas: freehire respondeu ${r.status}`);
        return null;
      }
      return (await r.json()) as { data?: unknown; meta?: unknown };
    } catch (e) {
      this.log.warn(`facetas indisponiveis: ${String(e).slice(0, 120)}`);
      return null;
    }
  }
}
