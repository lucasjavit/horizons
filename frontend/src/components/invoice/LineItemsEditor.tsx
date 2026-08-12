import { useId } from 'react'
import {
  formatCents,
  lineAmountCents,
  parseAmountToCents,
  parseQuantity,
} from '../../invoice/money'
import type { CurrencyCode, LineItem } from '../../invoice/types'
import { WARN_INK } from '../blocks/BlockRenderer'

type CampoItem = 'description' | 'quantity' | 'rate'

interface LineItemsEditorProps {
  items: LineItem[]
  currency: CurrencyCode
  error?: string
  /** Erros por campo, na chave `${id}.quantity` / `${id}.rate`. */
  itemErrors?: Record<string, string | undefined>
  onChange: (id: string, campo: CampoItem, valor: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onMove: (id: string, direcao: -1 | 1) => void
}

const GRADE = 'sm:grid-cols-[1fr_5rem_7rem_7rem_6.5rem]'

export function LineItemsEditor({
  items,
  currency,
  error,
  itemErrors,
  onChange,
  onAdd,
  onRemove,
  onMove,
}: LineItemsEditorProps) {
  return (
    <section aria-labelledby="items-heading">
      <h2 id="items-heading" className="text-lg font-semibold tracking-tight">
        Items
      </h2>

      {/* Cabecalho so visual: e aria-hidden porque nao rotula nada de forma
          programatica — cada input carrega o proprio label. */}
      <div
        aria-hidden
        className={`mt-4 hidden gap-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide sm:grid ${GRADE}`}
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <span>Description</span>
        <span>Qty</span>
        <span>Rate</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <ul className="mt-3 flex flex-col gap-4 sm:mt-0 sm:gap-0">
        {items.map((item, i) => (
          <LineItemRow
            key={item.id}
            item={item}
            posicao={i + 1}
            total={items.length}
            currency={currency}
            erroQtd={itemErrors?.[`${item.id}.quantity`]}
            erroRate={itemErrors?.[`${item.id}.rate`]}
            onChange={onChange}
            onRemove={onRemove}
            onMove={onMove}
          />
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 rounded-md border px-4 py-2.5 text-sm font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        + Add item
      </button>
    </section>
  )
}

interface RowProps {
  item: LineItem
  posicao: number
  total: number
  currency: CurrencyCode
  erroQtd?: string
  erroRate?: string
  onChange: (id: string, campo: CampoItem, valor: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, direcao: -1 | 1) => void
}

function LineItemRow({
  item,
  posicao,
  total,
  currency,
  erroQtd,
  erroRate,
  onChange,
  onRemove,
  onMove,
}: RowProps) {
  // useId da o prefixo unico da linha; sem ele, dois <label for="qty">
  // apontariam para o mesmo campo.
  const uid = useId()
  const idDesc = `${uid}-desc`
  const idQtd = `${uid}-qty`
  const idRate = `${uid}-rate`

  const valor = lineAmountCents(
    parseQuantity(item.quantity) ?? 0,
    parseAmountToCents(item.rate) ?? 0,
  )

  // O rotulo mais importante da feature: sem o nome da linha, quem usa
  // leitor de tela ouve "Rate, Rate, Rate" descendo a coluna sem saber
  // em que linha esta.
  const rotulo = item.description.trim() || `item ${posicao}`

  return (
    <li
      className={`grid gap-2 rounded-lg border p-3 sm:items-start sm:gap-3 sm:rounded-none sm:border-0 sm:border-b sm:p-0 sm:py-2.5 ${GRADE}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div>
        <label htmlFor={idDesc} className="mb-1 block text-xs font-medium sm:sr-only">
          Description <span className="sr-only">for item {posicao}</span>
        </label>
        <input
          id={idDesc}
          type="text"
          value={item.description}
          onChange={(e) => onChange(item.id, 'description', e.target.value)}
          placeholder="Website redesign"
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
          }}
        />
      </div>

      <div>
        <label htmlFor={idQtd} className="mb-1 block text-xs font-medium sm:sr-only">
          Qty <span className="sr-only">for {rotulo}</span>
        </label>
        {/* text + inputMode em vez de type="number": o numerico descarta
            entrada invalida em silencio, muda de valor com a roda do mouse
            e tem setinhas de alvo minusculo. */}
        <input
          id={idQtd}
          type="text"
          inputMode="decimal"
          value={item.quantity}
          onChange={(e) => onChange(item.id, 'quantity', e.target.value)}
          aria-invalid={erroQtd ? true : undefined}
          aria-describedby={erroQtd ? `${idQtd}-error` : undefined}
          className="w-full rounded-md border px-3 py-2 text-sm tabular-nums"
          style={{
            borderColor: erroQtd ? WARN_INK : 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
          }}
        />
        {erroQtd && (
          <p
            id={`${idQtd}-error`}
            role="alert"
            className="mt-1 text-xs"
            style={{ color: WARN_INK }}
          >
            {erroQtd}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={idRate} className="mb-1 block text-xs font-medium sm:sr-only">
          Rate <span className="sr-only">for {rotulo}</span>
        </label>
        <input
          id={idRate}
          type="text"
          inputMode="decimal"
          value={item.rate}
          onChange={(e) => onChange(item.id, 'rate', e.target.value)}
          placeholder="0.00"
          aria-invalid={erroRate ? true : undefined}
          aria-describedby={erroRate ? `${idRate}-error` : undefined}
          className="w-full rounded-md border px-3 py-2 text-sm tabular-nums"
          style={{
            borderColor: erroRate ? WARN_INK : 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
          }}
        />
        {erroRate && (
          <p
            id={`${idRate}-error`}
            role="alert"
            className="mt-1 text-xs"
            style={{ color: WARN_INK }}
          >
            {erroRate}
          </p>
        )}
      </div>

      {/* Valor e derivado, entao nao e input. aria-live off de proposito:
          anunciar a cada tecla seria tagarelice. */}
      <p className="text-sm font-medium tabular-nums sm:pt-2 sm:text-right">
        <span className="sm:sr-only" style={{ color: 'var(--text-muted)' }}>
          Amount:{' '}
        </span>
        <output htmlFor={`${idQtd} ${idRate}`} aria-live="off">
          {formatCents(valor, currency)}
        </output>
      </p>

      <div className="flex justify-end gap-1 sm:pt-0.5">
        <BotaoLinha
          onClick={() => onMove(item.id, -1)}
          disabled={posicao === 1}
          label={`Move ${rotulo} up`}
          glifo="↑"
        />
        <BotaoLinha
          onClick={() => onMove(item.id, 1)}
          disabled={posicao === total}
          label={`Move ${rotulo} down`}
          glifo="↓"
        />
        <BotaoLinha
          onClick={() => onRemove(item.id)}
          label={`Remove ${rotulo}`}
          glifo="×"
        />
      </div>
    </li>
  )
}

function BotaoLinha({
  onClick,
  disabled,
  label,
  glifo,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  glifo: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      // 36px: acima do minimo de 24px da WCAG 2.5.8.
      className="h-9 w-9 rounded-md border text-sm disabled:opacity-40"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      {/* O glifo e decorativo: sem aria-hidden, o leitor anuncia
          "sinal de multiplicacao" em vez do rotulo do botao. */}
      <span aria-hidden>{glifo}</span>
    </button>
  )
}
