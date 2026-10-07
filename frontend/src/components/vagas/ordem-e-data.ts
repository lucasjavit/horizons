import type { OrdemAplicada, OrdemDaBusca } from '../../types/api'

/**
 * A ordem da lista e a janela `Posted` (JOB-54).
 *
 * Os valores de `ORDENS` são exatamente os que o backend aceita (`ORDENS` em
 * `job.dto.ts`): mandar outra coisa é 400 do `ValidationPipe`, e o rótulo é só
 * apresentação.
 */
export interface OpcaoDeOrdem {
  valor: OrdemDaBusca
  rotulo: string
}

/** `Newest` primeiro porque é o padrão — quem busca vaga quer a que acabou de abrir. */
export const ORDENS: OpcaoDeOrdem[] = [
  { valor: 'newest', rotulo: 'Newest' },
  { valor: 'relevance', rotulo: 'Relevance' },
  { valor: 'views', rotulo: 'Most viewed' },
  { valor: 'match', rotulo: 'Best match' },
]

export const ORDEM_PADRAO: OrdemDaBusca = 'newest'

/**
 * As janelas de `Posted`, em dias. `null` é `Any time`.
 *
 * **Escolha única.** O filtro antigo (`idades` em `vaga-filtro.ts`) era múltipla
 * escolha que mandava a MAIOR — escolha única disfarçada. `Today` é
 * `posted_within_days=1`: as últimas 24 horas, que é a menor janela que a API
 * tem (medido em 05/10/2026: 523 vagas em LATAM, todas do dia).
 */
export const JANELAS: { dias: number | null; rotulo: string }[] = [
  { dias: null, rotulo: 'Any time' },
  { dias: 1, rotulo: 'Today' },
  { dias: 3, rotulo: 'Last 3 days' },
  { dias: 7, rotulo: 'Last 7 days' },
  { dias: 14, rotulo: 'Last 14 days' },
  { dias: 30, rotulo: 'Last 30 days' },
]

/**
 * O rótulo de uma janela, inclusive das que a tela não oferece mais.
 *
 * Busca salva antiga carrega 20 ou 90 dias. Ela continua abrindo, e o seletor
 * mostra o valor que está valendo em vez de fingir `Any time`.
 */
export function rotuloDaJanela(dias: number | null): string {
  if (dias === null) return 'Any time'
  return JANELAS.find((j) => j.dias === dias)?.rotulo ?? `Last ${dias} days`
}

/**
 * A menor janela que o anônimo consegue usar.
 *
 * Sem sessão a busca só devolve vaga com 14 dias ou mais (JOB-47): `Today` a
 * `Last 14 days` dariam lista vazia sempre, e oferecê-las seria um filtro que
 * só sabe responder "nada".
 */
export const JANELA_MINIMA_DO_ANONIMO = 30

/**
 * Tira `posted_within_days` de uma seleção vinda do modal.
 *
 * O modal nunca escreve esse campo; quem o traz é busca salva antiga, aberta
 * por lá. Fica separado para o valor aparecer no seletor `Posted` — dentro da
 * seleção ele viajaria na busca sem estar em lugar nenhum da tela.
 */
export function separarJanela(selecao: Record<string, unknown>): {
  selecao: Record<string, string[]>
  dias: number | null
} {
  const { posted_within_days: bruto, ...resto } = selecao
  const dias = typeof bruto === 'number' && Number.isInteger(bruto) && bruto >= 1 ? bruto : null
  return { selecao: resto as Record<string, string[]>, dias }
}

const NOME_DA_ORDEM: Record<Exclude<OrdemAplicada, null>, string> = {
  newest: 'newest first',
  relevance: 'by relevance',
  views: 'most viewed first',
  match: 'best match first',
  oldest: 'oldest first',
}

/**
 * O aviso de que a lista NÃO está na ordem pedida, ou `null` se está.
 *
 * `Most viewed` e `Relevance` só existem no agregador. Quando ele não responde
 * e a busca cai para outra fonte, a lista vem por data (ou sem ordem
 * garantida) — e o seletor continuaria dizendo `Most viewed`. A tela não sabe
 * de antemão qual fonte vai responder, então diz depois, com o que de fato veio.
 */
export function avisoDeOrdem(
  pedida: OrdemDaBusca,
  aplicada: OrdemAplicada | undefined,
): string | null {
  // `undefined` = servidor antigo, que não informa: nada a afirmar.
  if (aplicada === undefined || aplicada === pedida) return null
  const rotulo = ORDENS.find((o) => o.valor === pedida)?.rotulo ?? pedida
  if (aplicada === null) {
    return `This search was answered by a source that cannot sort. "${rotulo}" was not applied.`
  }
  return `This search was answered by a source that cannot sort by "${rotulo}". Showing ${NOME_DA_ORDEM[aplicada]} instead.`
}
