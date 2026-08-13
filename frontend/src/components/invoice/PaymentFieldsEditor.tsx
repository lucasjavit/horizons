import { useId } from 'react'
import type { PaymentField } from '../../invoice/types'

interface PaymentFieldsEditorProps {
  fields: PaymentField[]
  onChange: (id: string, campo: 'label' | 'value', valor: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
}

/**
 * Dados de pagamento como linhas de rotulo + valor, as duas editaveis.
 *
 * O rotulo e dado, nao codigo: quem recebe por transferencia precisa de IBAN
 * e SWIFT, quem recebe por Wise precisa so de um e-mail. Campos fixos
 * serviriam bem a um caso e mal a todos os outros, entao a pessoa renomeia,
 * apaga e acrescenta o que quiser.
 *
 * Linha em branco nao aparece no PDF — quem nao usa IBAN so deixa vazio.
 */
export function PaymentFieldsEditor({
  fields,
  onChange,
  onAdd,
  onRemove,
}: PaymentFieldsEditorProps) {
  return (
    <div>
      {fields.length === 0 ? (
        <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          No payment details on this invoice.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {fields.map((f) => (
            <LinhaPagamento
              key={f.id}
              field={f}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 rounded-md border px-4 py-2.5 text-sm font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        + Add field
      </button>
    </div>
  )
}

function LinhaPagamento({
  field,
  onChange,
  onRemove,
}: {
  field: PaymentField
  onChange: (id: string, campo: 'label' | 'value', valor: string) => void
  onRemove: (id: string) => void
}) {
  const uid = useId()
  const idLabel = `${uid}-label`
  const idValor = `${uid}-value`

  // Mesmo cuidado das linhas de item: sem o nome do campo no rotulo, o
  // leitor de tela anuncia "Value, Value, Value" descendo a coluna.
  const nome = field.label.trim() || 'this field'

  const estilo = {
    borderColor: 'var(--border)',
    background: 'var(--surface-sunken)',
    color: 'var(--text)',
  }

  return (
    <li className="grid gap-2 sm:grid-cols-[13rem_1fr_2.25rem] sm:items-center sm:gap-3">
      <div>
        <label htmlFor={idLabel} className="mb-1 block text-xs font-medium sm:sr-only">
          Field name
        </label>
        <input
          id={idLabel}
          type="text"
          value={field.label}
          onChange={(e) => onChange(field.id, 'label', e.target.value)}
          placeholder="IBAN"
          className="w-full rounded-md border px-3 py-2 text-sm font-medium"
          style={estilo}
        />
      </div>

      <div>
        <label htmlFor={idValor} className="mb-1 block text-xs font-medium sm:sr-only">
          Value <span className="sr-only">for {nome}</span>
        </label>
        <input
          id={idValor}
          type="text"
          value={field.value}
          onChange={(e) => onChange(field.id, 'value', e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={estilo}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(field.id)}
          aria-label={`Remove ${nome}`}
          className="h-9 w-9 rounded-md border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </li>
  )
}
