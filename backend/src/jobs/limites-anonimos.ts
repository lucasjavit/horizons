/**
 * O que a busca sem login pode alcancar (JOB-47).
 *
 * **Existe como modulo proprio, e nao como dois `if (usuario)` espalhados.**
 * Sao duas restricoes que precisam andar JUNTAS — o motor e o corte de data —,
 * e separa-las e o jeito de uma sobreviver a um refactor sem a outra. Quem le
 * `limitesDe(usuario)` ve as duas, e quem acrescentar uma terceira a escreve
 * aqui em vez de num handler.
 *
 * ## As duas decisoes do stakeholder (01/10/2026)
 *
 * **1. Anonimo so no motor freehire.** Sem ATS, sem Firecrawl, sem IA. A razao
 * nao e preferencia de qualidade: o projeto **nao tem rate limiting**, e uma
 * rota aberta que alcance motor pago e um script contra a chave de quem paga.
 * O freehire e API publica sem chave (JOB-39), entao o custo do anonimo e zero
 * garantido — e nao "quase zero", que e o que o ATS seria (publico, mas 128s
 * de CPU nossa por busca, em 526 boards).
 *
 * **2. Anonimo ve so vaga com 14 dias ou mais de publicada.** E decisao de
 * PRODUTO, e esta e a frase que a explica: **o valor do cadastro e chegar
 * primeiro na vaga nova.** O anonimo recebe amostra real — a busca de verdade,
 * os filtros, o acervo — e nao a vantagem competitiva. Quem entra ganha a vaga
 * de hoje; quem nao entra ve a de duas semanas atras, que ainda e vaga de
 * verdade e ainda esta aberta.
 *
 * ## Por que o corte vive na SESSAO, e nao no corpo da requisicao
 *
 * `POST /jobs/search/mais` manda **so o id da sessao** (ver
 * `MaisVagasPedidoDto`). Isso nao e economia de bytes: e o que impede a pagina
 * 2 de vir com restricao diferente da pagina 1. Se o limite viajasse no corpo,
 * um cliente anonimo mandaria `{anonimo: false}` e receberia o acervo inteiro.
 * Aqui ele e gravado na abertura e relido do servidor a cada pagina.
 */

/** Quantos dias uma vaga precisa ter para o anonimo ve-la. */
export const DIAS_PARA_O_ANONIMO = 14;

/**
 * O teto da janela que o anonimo enxerga, em dias.
 *
 * **Nao e uma restricao a mais: e o que torna o corte possivel pela API.**
 * Medido em 01/10/2026 contra `freehire.me`: a API **nao tem** parametro de
 * "mais velha que N dias" — `posted_before_days`, `posted_after_days`,
 * `posted_min_days`, `posted_older_than_days`, `posted_at_before`,
 * `min_age_days` todos voltaram em `meta.ignored_params` com o total intacto
 * (58.782 vagas em `regions=latam`, identico ao da consulta sem parametro).
 *
 * O que ela tem e `posted_within_days` (mais NOVA que N) e `sort=posted_at`.
 * Combinando os dois — janela de 90 dias, ordenada do mais VELHO para o mais
 * novo — a ponta velha da janela e exatamente o que o anonimo pode ver, e a
 * API faz o corte. Medido na mesma data, `regions=latam`:
 *
 * | consulta                                   | linhas | com 14+ dias |
 * | ------------------------------------------ | -----: | -----------: |
 * | padrao (sort implicito, mais novas)        |     60 |            0 |
 * | `within=90` + `sort=posted_at&order=asc`   |     60 |           60 |
 * | idem, 5 paginas (offset 0..240)            |    300 |          300 |
 *
 * **Sem a janela, o `asc` e inutilizavel.** `sort=posted_at&order=asc` sem
 * limite superior traz o fundo do catalogo: as 5 primeiras linhas vinham com
 * `posted_at` de `1970-01-01`, `2010-03-01`, `2011-08-23` — datas de board
 * quebrado, com `reality: stale`. O anonimo veria lixo arqueologico e
 * concluiria que o produto nao tem vaga. Com `within=90` a faixa real e 15 a
 * 89 dias, e sao **31.369 vagas** so em LATAM (44.212 em 90 dias menos 12.843
 * em 14).
 *
 * 90 e nao 30 porque a faixa precisa ser funda o bastante para o teto de 300
 * da sessao caber nela com filtro apertado, e nao e preciso ser mais funda que
 * isso: vaga de 3 meses tem chance real de ja estar fechada, e oferece-la seria
 * piorar a amostra em vez de aumenta-la.
 */
export const JANELA_DO_ANONIMO_EM_DIAS = 90;

/**
 * O que uma busca pode fazer, dado quem a pediu.
 *
 * Um objeto e nao um booleano `anonimo` porque quem consome quer saber **o que
 * pode**, e nao **quem e**. A diferenca aparece no `busca.service`: ele
 * pergunta `limites.somenteFreehire`, que e a pergunta que ele tem para fazer,
 * em vez de reimplementar a politica a partir de "tem usuario?".
 */
export interface LimitesDaBusca {
  /**
   * So o motor freehire. Os outros nao sao tentados nem quando o freehire
   * devolve zero — **a cascata para aqui**, porque cair para o ATS ou para a
   * IA e exatamente o que esta restricao existe para impedir.
   */
  somenteFreehire: boolean;
  /**
   * Idade minima da vaga, em dias. `null` = sem corte (o acervo inteiro).
   */
  idadeMinimaEmDias: number | null;
  /**
   * Teto da janela, em dias. `null` = sem teto.
   *
   * So faz sentido junto com `idadeMinimaEmDias` — ver a constante acima.
   */
  janelaMaximaEmDias: number | null;
}

/** Com sessao: a cadeia inteira e o acervo inteiro, como sempre foi. */
export const LIMITES_COM_SESSAO: LimitesDaBusca = {
  somenteFreehire: false,
  idadeMinimaEmDias: null,
  janelaMaximaEmDias: null,
};

/** Sem sessao: um motor gratuito, e so a parte envelhecida do acervo. */
export const LIMITES_ANONIMOS: LimitesDaBusca = {
  somenteFreehire: true,
  idadeMinimaEmDias: DIAS_PARA_O_ANONIMO,
  janelaMaximaEmDias: JANELA_DO_ANONIMO_EM_DIAS,
};

/**
 * Os limites de quem pediu a busca.
 *
 * **O argumento e o usuario e nao um booleano** de proposito: o chamador passa
 * o que o `@CurrentUser()` lhe deu, sem traduzir. Um `limitesDe(!!usuario)`
 * convidaria o erro de inverter o booleano no ponto de chamada, e inverter
 * ESTE booleano e dar o acervo inteiro ao anonimo.
 */
export function limitesDe(usuario: { id: string } | null | undefined): LimitesDaBusca {
  return usuario ? LIMITES_COM_SESSAO : LIMITES_ANONIMOS;
}

/**
 * A vaga e velha o bastante para o anonimo?
 *
 * **A guarda local existe mesmo com a API fazendo o corte**, e a razao esta na
 * spec deles: *"Some boards restate this date on every crawl, so a posting that
 * has been open for months can satisfy a narrow bound here"*. O
 * `posted_within_days` le a data que a FONTE declara, e uma fonte que reescreve
 * a data a cada crawl pode empurrar uma vaga nova para dentro da janela velha.
 * A API corta o volume; isto corta o que escapar.
 *
 * **Sem data, a vaga NAO passa.** E o lado seguro do desconhecido: deixar
 * passar o que nao se sabe datar entregaria a vaga de hoje ao anonimo, que e a
 * unica coisa que esta regra existe para evitar. Medido em 01/10: nas tres
 * consultas de amostra, zero das 180 linhas vieram sem `posted_at`, entao o
 * custo real disto e proximo de nada.
 */
export function velhaOBastante(
  postedAt: string | null | undefined,
  idadeMinimaEmDias: number,
  agora: Date = new Date(),
): boolean {
  if (!postedAt) return false;
  const publicada = new Date(postedAt).getTime();
  // Data impronunciavel conta como data ausente, e pelo mesmo motivo.
  if (Number.isNaN(publicada)) return false;
  const dias = (agora.getTime() - publicada) / 86_400_000;
  return dias >= idadeMinimaEmDias;
}
