import type { FiltrosDto, OrdemDaBusca, VagaDto } from './job.dto';
import type { LimitesDaBusca } from './limites-anonimos';
import type { MotorDaSessao } from './sessao-de-busca.service';

/**
 * A ordem da lista de vagas (JOB-54).
 *
 * **Vive num modulo proprio porque tres lugares precisam da MESMA resposta**
 * para "que ordem e esta?": a consulta que vai ao freehire
 * (`freehire-consulta.ts`), a reordenacao local do `Best match` e o evento
 * `fim`, que diz a tela que ordem a lista de fato tem. Se cada um decidisse
 * sozinho, a tela anunciaria `Most viewed` sobre uma lista que o ATS ordenou
 * por data — plausivel demais para alguem notar.
 */

/**
 * A ordem que a lista realmente tem. `oldest` nao e escolha de ninguem: e o
 * que a regra do anonimo (JOB-47) impoe, e a tela precisa poder dize-lo.
 * `null` = o motor nao garante ordem nenhuma (IA, Firecrawl).
 */
export type OrdemAplicada = OrdemDaBusca | 'oldest' | null;

/**
 * A ordem pedida, depois de tirar o pedido que nao da para honrar.
 *
 * **`match` sem tecnologia vira `newest`, e nao `relevance` em silencio.** O
 * `Best match` compara as skills da vaga com as tecnologias do filtro (e para
 * la que o curriculo escreve a stack). Sem nenhuma, toda vaga empata em zero e
 * a "ordenacao" seria a ordem da API com um rotulo que promete outra coisa. A
 * tela ja desabilita a opcao nesse caso; isto e a mesma regra para quem chama
 * a API direto.
 */
export function ordemEfetiva(f: FiltrosDto): OrdemDaBusca | undefined {
  if (f.sort === 'match' && tecnologiasDe(f).length === 0) return 'newest';
  return f.sort;
}

/**
 * A ordem que a lista de fato tem, dado quem respondeu e quem pediu.
 *
 * **Motor que nao honra o pedido nao finge** (restricao do card): `view_count`
 * e relevancia so existem no freehire. O ATS sempre ordena por data
 * (`busca-ats.service.ts`), entao e isso que ele declara; IA e Firecrawl nao
 * garantem ordem. A tela compara com o que pediu e avisa quando difere.
 */
export function ordemAplicada(
  motor: MotorDaSessao,
  f: FiltrosDto,
  limites: LimitesDaBusca,
): OrdemAplicada {
  // O corte do anonimo vence qualquer escolha — ver `freehire-consulta.ts`.
  if (limites.idadeMinimaEmDias !== null) return 'oldest';
  const pedida = ordemEfetiva(f);
  if (motor === 'freehire') return pedida ?? null;
  if (motor === 'ats') return pedida === 'match' ? 'match' : 'newest';
  return null;
}

/**
 * Reordena o lote quando a ordem pedida e `match`; senao devolve como veio.
 *
 * **Reordena so o lote que recebeu** — as 60 da pagina, e nao o catalogo. A
 * API nao tem "best match", entao nao ha como pedir a ela as 60 mais afins de
 * 4.846: o que se faz e por as mais afins DESTAS 60 na frente. A pagina
 * seguinte e outro lote, reordenado dentro de si. O card registra o limite.
 *
 * Nao mexe na lista do anonimo: la a ordem e parte da permissao (JOB-47).
 */
export function ordenarLote(
  vagas: VagaDto[],
  f: FiltrosDto,
  limites: LimitesDaBusca,
): VagaDto[] {
  if (limites.idadeMinimaEmDias !== null) return vagas;
  if (ordemEfetiva(f) !== 'match') return vagas;
  return ordenarPorAfinidade(vagas, tecnologiasDe(f));
}

/**
 * Mais tecnologias em comum primeiro; no empate, a mais recente.
 *
 * Sem data vai para o fim do empate, pelo mesmo motivo do ATS: `postedAt` nulo
 * nao e "antiga", mas nao pode passar na frente de quem provou ser de ontem.
 * `sort` do V8 e estavel, entao empate total preserva a ordem da API.
 */
export function ordenarPorAfinidade(vagas: VagaDto[], tecnologias: string[]): VagaDto[] {
  const alvo = new Set(tecnologias.map(normalizar).filter((t) => t.length > 0));
  const pontos = new Map<VagaDto, number>();
  for (const v of vagas) pontos.set(v, afinidade(v, alvo));
  return [...vagas].sort((a, b) => {
    const d = (pontos.get(b) ?? 0) - (pontos.get(a) ?? 0);
    if (d !== 0) return d;
    return quando(b) - quando(a);
  });
}

/** Quantas das tecnologias pedidas a vaga lista. */
function afinidade(v: VagaDto, alvo: Set<string>): number {
  const dela = new Set(v.skills.map(normalizar));
  let n = 0;
  for (const t of alvo) if (dela.has(t)) n++;
  return n;
}

function quando(v: VagaDto): number {
  const t = v.postedAt ? Date.parse(v.postedAt) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

/** As tecnologias do filtro — onde o curriculo e o modal escrevem a stack. */
function tecnologiasDe(f: FiltrosDto): string[] {
  return (f.technologies ?? []).filter((t) => t.trim().length > 0);
}

/**
 * Nomes que a pontuacao nao resolve.
 *
 * Medido em 05/10/2026: as skills do freehire sao slugs (`nodejs`, `csharp`,
 * `ci-cd`, `dotnet`), e o curriculo escreve "Node.js", "C#", ".NET". Tirar a
 * pontuacao casa o primeiro; os outros precisam de nome.
 */
const APELIDOS: Record<string, string> = {
  'c#': 'csharp',
  'c++': 'cpp',
  net: 'dotnet',
  golang: 'go',
  postgres: 'postgresql',
  k8s: 'kubernetes',
};

/** Minusculas, sem acento e sem pontuacao — "Node.js" e `nodejs` sao um so. */
function normalizar(s: string): string {
  const limpo = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // `+` e `#` sao nome, e nao pontuacao: sem eles "C#" e "C++" viram "c".
    .replace(/[^a-z0-9+#]/g, '');
  return APELIDOS[limpo] ?? limpo;
}
