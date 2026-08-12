import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/**
 * Quadro do backlog, dentro do app.
 *
 * TEMPORARIO — sai quando o projeto amadurecer. Por isso vive num arquivo so,
 * sem componente compartilhado e sem tocar em nada existente: remover e
 * apagar este arquivo, `public/quadro.json` e as tres linhas do App.tsx
 * marcadas com QUADRO.
 *
 * Os dados vem de `public/quadro.json`, gerado por `scripts/kanban-html.py`
 * a partir dos cards markdown. A pagina so aparece em desenvolvimento.
 */

interface Card {
  id: string
  titulo: string
  estado: string
  coluna: string
  tamanho: string
  porque: string
  decisao: string
  bloqueio: string
  feitos: number
  total: number
}

interface Quadro {
  colunas: { chave: string; rotulo: string }[]
  sprint: { titulo: string; objetivo: string } | null
  cards: Card[]
}

export function QuadroPage() {
  useDocumentTitle('Quadro')

  const [dados, setDados] = useState<Quadro | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    // fetch direto, e nao o cliente da API: isto e um arquivo estatico
    // servido pelo proprio front, nao um endpoint do backend.
    fetch(`${import.meta.env.BASE_URL}quadro.json`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Quadro>
      })
      .then(setDados)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        setErro(
          'Nao foi possivel ler o quadro. Rode: python3 scripts/kanban-html.py',
        )
      })
    return () => ctrl.abort()
  }, [])

  if (erro)
    return (
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState message={erro} />
      </main>
    )
  if (!dados)
    return (
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10">
        <LoadingState label="Carregando o quadro…" />
      </main>
    )

  const feitos = dados.cards.filter((c) => c.coluna === 'feito').length

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6"
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Quadro</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {dados.cards.length} cards · {feitos} feitos · gerado de{' '}
          <code className="font-mono">docs/backlog/cards/</code>
        </p>
      </header>

      {dados.sprint && (
        <aside
          className="mb-8 rounded-lg border border-l-4 p-4"
          style={{
            borderColor: 'var(--border)',
            borderLeftColor: 'var(--brand)',
            background: 'var(--surface-sunken)',
          }}
        >
          <p
            className="text-[0.7rem] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Sprint atual
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">
            {dados.sprint.titulo}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {dados.sprint.objetivo}
          </p>
        </aside>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dados.colunas.map((col) => {
          const lista = dados.cards.filter((c) => c.coluna === col.chave)
          return (
            <section key={col.chave} aria-labelledby={`col-${col.chave}`}>
              <h2
                id={`col-${col.chave}`}
                className="mb-3 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-widest"
                style={{
                  color:
                    col.chave === 'feito' ? 'var(--brand)' : 'var(--text-muted)',
                }}
              >
                {col.rotulo}
                <span
                  className="rounded-full border px-1.5 text-[0.68rem] tracking-normal"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface-sunken)',
                  }}
                >
                  {lista.length}
                </span>
              </h2>

              {lista.length === 0 ? (
                <EmptyState message="Nada aqui." />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {lista.map((c) => (
                    <Cartao key={c.id} card={c} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}

function Cartao({ card }: { card: Card }) {
  const parcial = card.estado.toLowerCase().includes('parcial')
  // Card feito com criterios desmarcados mostraria "0/5" e pareceria parado.
  const mostraBarra =
    card.total > 0 && !(card.coluna === 'feito' && card.feitos === 0)

  return (
    <li
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--border)',
        borderLeftWidth: card.coluna === 'feito' ? 3 : 1,
        borderLeftColor:
          card.coluna === 'feito' ? 'var(--brand)' : 'var(--border)',
        background: 'var(--surface-raised)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[0.68rem] font-bold tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {card.id}
        </span>
        <span
          className="rounded border px-1 font-mono text-[0.62rem] font-bold"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title="Tamanho"
        >
          {card.tamanho}
        </span>
      </div>

      <h3 className="mt-1.5 text-sm font-semibold leading-snug tracking-tight">
        {card.titulo}
        {parcial && (
          <span
            className="ml-1.5 rounded border px-1 align-middle text-[0.6rem] font-bold uppercase tracking-wide"
            style={{ borderColor: 'var(--accent-ink)', color: 'var(--accent-ink)' }}
          >
            parcial
          </span>
        )}
      </h3>

      <p
        className="mt-1 text-xs leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {card.porque}
      </p>

      {card.decisao && (
        <p
          className="mt-2 border-t pt-2 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <strong style={{ color: 'var(--text)' }}>Decisão:</strong>{' '}
          {card.decisao}
        </p>
      )}
      {!card.decisao && card.bloqueio && (
        <p
          className="mt-2 border-t pt-2 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--accent-ink)' }}
        >
          Depende de: {card.bloqueio}
        </p>
      )}

      {mostraBarra && (
        <div
          className="mt-2.5 flex items-center gap-2"
          role="img"
          aria-label={`${card.feitos} de ${card.total} criterios atendidos`}
        >
          <div
            className="h-1 flex-1 overflow-hidden rounded-full border"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-sunken)',
            }}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.round((card.feitos / card.total) * 100)}%`,
                background: 'var(--brand)',
              }}
            />
          </div>
          <span
            className="font-mono text-[0.65rem]"
            style={{ color: 'var(--text-muted)' }}
          >
            {card.feitos}/{card.total}
          </span>
        </div>
      )}
    </li>
  )
}
