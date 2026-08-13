import { useState } from 'react'
import type { HistoryEntry } from '../../invoice/history'
import { formatCents } from '../../invoice/money'
import { invoiceTotalCents } from '../../invoice/pdf'
import { WARN_INK } from '../blocks/BlockRenderer'

interface InvoiceHistoryProps {
  entries: HistoryEntry[]
  onOpen: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
}

/**
 * Invoices ja baixadas, guardadas neste navegador.
 *
 * Clicar num registro carrega a invoice no formulario. Editar e baixar cria
 * um registro NOVO — o original fica intacto. Baixar sem mudar nada nao
 * duplica; so traz o registro para o topo.
 *
 * Nao substitui o historico com login (INV-10). Este e o que funciona hoje,
 * sem cadastro, e o aviso no rodape deixa claro o limite.
 */
export function InvoiceHistory({
  entries,
  onOpen,
  onRemove,
}: InvoiceHistoryProps) {
  const [confirmando, setConfirmando] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Invoices you download show up here, so you can open one again or use it
        as the base for the next month.
      </p>
    )
  }

  return (
    <section className="mt-4">
      <h2
        id="history-heading"
        className="mb-3 text-[0.7rem] font-bold uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}
      >
        Recent invoices
      </h2>

      <ul className="flex flex-col gap-1.5">
        {entries.map((e) => {
          const total = invoiceTotalCents(e.draft)
          const nome = e.draft.invoiceNumber.trim() || 'No number'
          const cliente = e.draft.billTo.name.trim()

          return (
            <li
              key={e.id}
              className="flex items-center gap-2 rounded-lg border p-2.5"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-raised)',
              }}
            >
              <button
                type="button"
                onClick={() => onOpen(e)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold">{nome}</span>
                  <span className="text-xs font-semibold tabular-nums">
                    {formatCents(total, e.draft.currency)}
                  </span>
                </span>
                <span
                  className="mt-0.5 flex items-baseline justify-between gap-2 text-[0.68rem]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="min-w-0 truncate">{cliente || '—'}</span>
                  <span className="shrink-0">{formatarData(e.savedAt)}</span>
                </span>
              </button>

              {confirmando === e.id ? (
                <span role="alert" className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onRemove(e.id)
                      setConfirmando(null)
                    }}
                    className="rounded-md px-2 py-1.5 text-[0.68rem] font-semibold"
                    style={{ background: WARN_INK, color: '#fff' }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    className="rounded-md border px-2 py-1.5 text-[0.68rem] font-medium"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(e.id)}
                  aria-label={`Remove ${nome} from history`}
                  className="h-8 w-8 shrink-0 rounded-md border text-xs"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span aria-hidden>×</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Saved in this browser only — clearing your browser data removes them.
      </p>
    </section>
  )
}
