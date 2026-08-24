/**
 * Quantas linhas por página.
 *
 * Vive aqui e não em cada tela: a lista de busca e a de salvas mostram a mesma
 * coisa, e duas constantes iguais em arquivos diferentes divergem na primeira
 * vez que alguém mexe numa só.
 */
export const POR_PAGINA = 25

/**
 * A navegação entre páginas.
 *
 * `nav` com `aria-label` porque é navegação de verdade, e o leitor de tela
 * precisa poder pular para cá. A página atual leva `aria-current="page"` — sem
 * isso, quem não vê a cor não sabe onde está.
 */
export function Paginacao({
  atual,
  paginas,
  total,
  onIr,
}: {
  atual: number
  paginas: number
  total: number
  onIr: (p: number) => void
}) {
  // Uma janela de até 5 números em volta da atual. Com 9 páginas, listar
  // todas ainda cabe; com 40, viraria uma régua ilegível.
  const inicio = Math.max(1, Math.min(atual - 2, paginas - 4))
  const fim = Math.min(paginas, inicio + 4)
  const numeros = []
  for (let i = inicio; i <= fim; i++) numeros.push(i)

  const botao =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm disabled:opacity-40'

  return (
    <nav
      aria-label="Job list pages"
      className="flex flex-wrap items-center justify-center gap-2 py-4"
    >
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
    </nav>
  )
}
