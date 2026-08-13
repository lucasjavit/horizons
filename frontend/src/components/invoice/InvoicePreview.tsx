import { formatCents } from '../../invoice/money'
import { invoiceTotalCents, linhasValidas } from '../../invoice/pdf'
import type { InvoiceDraft } from '../../invoice/types'

/**
 * O documento, desenhado em HTML enquanto a pessoa digita.
 *
 * Le `linhasValidas` e `invoiceTotalCents` do mesmo modulo que o PDF usa —
 * numero calculado duas vezes e numero que uma hora diverge. O que difere
 * entre os dois e so o desenho.
 *
 * Cores cruas aqui, como no PDF: e uma folha de papel, nao um pedaco da
 * interface. Nao acompanha o tema escuro, porque documento impresso nao tem
 * tema — e ver o papel branco contra o fundo escuro reforca que aquilo e o
 * arquivo que vai sair.
 */

const TINTA = '#0f1411'
const APAGADO = '#5c6b63' // 5,4:1 sobre branco — passa em AA
const VERDE = '#00704a'
const DOURADO = '#d4a017'
const LINHA = '#e5e9e7'

function formatarData(iso: string): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return iso
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function InvoicePreview({ draft }: { draft: InvoiceDraft }) {
  const linhas = linhasValidas(draft)
  const total = invoiceTotalCents(draft)

  const de = [
    draft.from.name.trim(),
    ...draft.from.address.split('\n'),
    draft.from.email.trim(),
    draft.from.taxId.trim() ? `Tax ID ${draft.from.taxId.trim()}` : '',
  ].filter((l) => l.trim())

  // So linha com valor entra no documento: quem nao usa IBAN deixa vazio e
  // ele nao aparece.
  const pagamento = draft.paymentFields.filter((c) => c.value.trim())

  const para = [
    draft.billTo.name.trim(),
    ...draft.billTo.address.split('\n'),
    draft.billTo.email.trim(),
  ].filter((l) => l.trim())

  return (
    <div
      // aria-hidden: e um espelho do formulario, que ja e todo rotulado.
      // Sem isto, quem usa leitor de tela ouviria tudo duas vezes.
      aria-hidden
      className="mx-auto w-full max-w-[38rem] rounded-lg p-8 shadow-lg sm:p-10"
      style={{ background: '#ffffff', color: TINTA, fontSize: '0.8rem' }}
    >
      <div style={{ height: 3, background: VERDE, marginBottom: '1.75rem' }} />

      <div className="flex items-start justify-between gap-6">
        <h3
          className="text-2xl font-bold tracking-tight"
          style={{ color: VERDE, margin: 0 }}
        >
          INVOICE
        </h3>
        <dl className="text-right" style={{ margin: 0 }}>
          {[
            ['Invoice #', draft.invoiceNumber.trim() || '—'],
            ['Issued', formatarData(draft.issueDate)],
            ['Due', formatarData(draft.dueDate)],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-end gap-3">
              <dt style={{ color: APAGADO }}>{rotulo}</dt>
              <dd className="font-semibold tabular-nums" style={{ margin: 0 }}>
                {valor}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Fio dourado, igual ao do PDF: o acento entra como linha fina, nunca
          como texto — sobre branco ele da ~2,2:1. */}
      <div style={{ height: 1, background: DOURADO, margin: '1.25rem 0 1.5rem' }} />

      <div className="grid grid-cols-2 gap-8">
        {[
          { titulo: 'FROM', linhas: de, vazio: 'Your details' },
          { titulo: 'BILL TO', linhas: para, vazio: "Client's details" },
        ].map((bloco) => (
          <div key={bloco.titulo}>
            <p
              className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-widest"
              style={{ color: APAGADO, margin: 0 }}
            >
              {bloco.titulo}
            </p>
            {bloco.linhas.length > 0 ? (
              bloco.linhas.map((l, i) => (
                <p
                  key={i}
                  className={i === 0 ? 'font-semibold' : ''}
                  style={{ margin: 0, lineHeight: 1.5 }}
                >
                  {l}
                </p>
              ))
            ) : (
              <p style={{ margin: 0, color: '#b0bfb8' }}>{bloco.vazio}</p>
            )}
          </div>
        ))}
      </div>

      <table className="mt-8 w-full" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: VERDE, color: '#fff' }}>
            {['DESCRIPTION', 'HOURS', 'RATE', 'AMOUNT'].map((h, i) => (
              <th
                key={h}
                className="px-2.5 py-2 text-[0.6rem] font-bold uppercase tracking-wider"
                style={{ textAlign: i === 0 ? 'left' : 'right' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-2.5 py-4 text-center"
                style={{ color: '#b0bfb8' }}
              >
                Your items will appear here
              </td>
            </tr>
          ) : (
            linhas.map((l, i) => (
              <tr key={i} style={{ background: i % 2 ? '#fff' : '#f6f8f7' }}>
                <td className="px-2.5 py-2">{l.descricao}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">{l.qtd}</td>
                <td className="px-2.5 py-2 text-right tabular-nums">
                  {formatCents(l.rateCents, draft.currency)}
                </td>
                <td className="px-2.5 py-2 text-right tabular-nums">
                  {formatCents(l.valorCents, draft.currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div
          className="flex items-center justify-between gap-8 rounded px-4 py-2.5"
          style={{ background: VERDE, color: '#fff', minWidth: '15rem' }}
        >
          <span className="text-[0.65rem] font-bold uppercase tracking-widest">
            Total due
          </span>
          <span className="text-base font-bold tabular-nums">
            {formatCents(total, draft.currency)}
          </span>
        </div>
      </div>

      {pagamento.length > 0 && (
        <div className="mt-8 pt-5" style={{ borderTop: `1px solid ${LINHA}` }}>
          <p
            className="mb-2 text-[0.62rem] font-bold uppercase tracking-widest"
            style={{ color: APAGADO, margin: 0 }}
          >
            PAYMENT DETAILS
          </p>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {pagamento.map((c) => (
                <tr key={c.id}>
                  <td className="py-0.5 pr-4" style={{ color: APAGADO, verticalAlign: 'top' }}>
                    {c.label.trim() || '—'}
                  </td>
                  <td className="py-0.5 text-right font-medium">{c.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
