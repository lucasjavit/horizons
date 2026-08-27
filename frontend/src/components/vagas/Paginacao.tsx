import { WARN_INK } from '../blocks/BlockRenderer'

/**
 * Quantas linhas por página.
 *
 * Vive aqui e não em cada tela: a lista de busca e a de salvas mostram a mesma
 * coisa, e duas constantes iguais em arquivos diferentes divergem na primeira
 * vez que alguém mexe numa só.
 */
export const POR_PAGINA = 25

/** Por que a busca parou de trazer vagas. Vem do backend (JOB-45). */
export type MotivoDoFim = 'teto' | 'fim' | null

/**
 * A navegação entre páginas.
 *
 * `nav` com `aria-label` porque é navegação de verdade, e o leitor de tela
 * precisa poder pular para cá. A página atual leva `aria-current="page"` — sem
 * isso, quem não vê a cor não sabe onde está.
 *
 * **Desde o JOB-45 há DUAS ações diferentes aqui, e a diferença é o card.** Os
 * números fatiam o que já está em memória e não custam nada; `Load more jobs`
 * dispara uma requisição de verdade ao serviço de vagas. Elas não podem parecer
 * a mesma coisa: o botão fica separado, numa linha própria abaixo dos números,
 * e diz o que faz.
 *
 * O botão só aparece na ÚLTIMA página, que é onde a pergunta "tem mais?"
 * nasce. Oferecê-lo na página 1 de 12 convidaria a buscar mais antes de a
 * pessoa ter olhado o que já tem.
 */
export function Paginacao({
  atual,
  paginas,
  total,
  onIr,
  temMais = false,
  carregandoMais = false,
  motivo = null,
  erro = '',
  onMais,
}: {
  atual: number
  paginas: number
  total: number
  onIr: (p: number) => void
  /** Há mais páginas para buscar no servidor (JOB-45). */
  temMais?: boolean
  carregandoMais?: boolean
  motivo?: MotivoDoFim
  /**
   * Falha ao buscar mais — exibida AQUI, junto ao botão.
   *
   * Ela morava no topo da página (QA, 27/08): a pessoa clicava no rodapé e a
   * explicação nascia 900px acima, fora da janela. O botão sumia em silêncio.
   */
  erro?: string
  onMais?: () => void
}) {
  // Uma janela de até 5 números em volta da atual. Com 9 páginas, listar
  // todas ainda cabe; com 40, viraria uma régua ilegível.
  const inicio = Math.max(1, Math.min(atual - 2, paginas - 4))
  const fim = Math.min(paginas, inicio + 4)
  const numeros = []
  for (let i = inicio; i <= fim; i++) numeros.push(i)

  const botao =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm disabled:opacity-40'

  // A oferta de buscar mais vive na última página. Sem `onMais` (a lista de
  // salvas, que não busca nada) ela nunca aparece.
  const naUltima = atual === paginas
  const podeBuscarMais = temMais && naUltima && !!onMais

  return (
    <nav
      aria-label="Job list pages"
      className="flex flex-col items-center gap-2 py-4"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onIr(atual - 1)}
          disabled={atual === 1}
          className={botao}
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Previous
        </button>

        {numeros.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onIr(n)}
            aria-current={n === atual ? 'page' : undefined}
            className={botao}
            style={{
              borderColor: n === atual ? 'var(--brand)' : 'var(--border)',
              background: n === atual ? 'var(--brand)' : 'var(--surface)',
              color: n === atual ? 'var(--brand-text)' : 'var(--text)',
              fontWeight: n === atual ? 600 : 400,
            }}
          >
            {n}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onIr(atual + 1)}
          disabled={atual === paginas}
          className={botao}
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Next
        </button>

        <span className="ml-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {total} jobs
        </span>
      </div>

      {/*
        A linha que diz o que ainda existe.

        **`aria-live="polite"`** porque o texto muda sozinho quando a busca
        volta — "Load more jobs" vira "That's all 84 jobs" sem que a pessoa
        mexa em nada, e quem usa leitor de tela precisa ouvir a mudança.
      */}
      <div className="min-h-9" aria-live="polite">
        {erro ? (
          // `role="alert"` e não só `aria-live`: é resposta a um gesto, e
          // interromper é o certo aqui. A borda carrega a informação junto
          // com o texto — nunca só cor.
          <p
            role="alert"
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: WARN_INK, color: WARN_INK }}
          >
            {erro}
          </p>
        ) : podeBuscarMais ? (
          <button
            type="button"
            onClick={onMais}
            disabled={carregandoMais}
            className="inline-flex min-h-9 items-center justify-center rounded-md border px-4 text-sm font-medium disabled:opacity-60"
            style={{
              borderColor: 'var(--brand)',
              background: 'var(--surface)',
              color: 'var(--brand)',
            }}
          >
            {carregandoMais ? 'Loading more jobs…' : 'Load more jobs'}
          </button>
        ) : naUltima && motivo ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {/*
              **"O nosso teto" e "acabou" são frases diferentes, e essa é a
              decisão do card.** Dizer "that's all" com 49 mil vagas no filtro
              seria mentira, e a ação que cada caso pede é oposta: um manda
              refinar o filtro, o outro diz que não há o que refinar.
            */}
            {motivo === 'teto'
              ? `Showing the first ${total} matches — refine the filters to see different jobs.`
              : `That's all ${total} jobs.`}
          </p>
        ) : null}
      </div>
    </nav>
  )
}
