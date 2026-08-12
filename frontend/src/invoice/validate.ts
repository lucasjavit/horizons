import { parseAmountToCents } from './money'
import type { InvoiceDraft } from './types'

export type InvoiceErrors = Partial<Record<string, string>>

/**
 * Validacao minima de proposito.
 *
 * Exigir demais num gerador de documento e hostil: muita fatura legitima nao
 * tem tax ID, e o freelancer pode genuinamente nao saber o endereco do
 * cliente. So e obrigatorio o que deixa o PDF sem sentido se faltar.
 */
export function validateDraft(d: InvoiceDraft): InvoiceErrors {
  const e: InvoiceErrors = {}

  if (!d.invoiceNumber.trim()) e.invoiceNumber = 'Invoice number is required.'
  if (!d.issueDate) e.issueDate = 'Issue date is required.'
  if (!d.from.name.trim()) e['from.name'] = 'Your name or company is required.'
  if (!d.billTo.name.trim()) e['billTo.name'] = "The client's name is required."

  // E-mail so e checado quando preenchido, e com regra frouxa: regex de
  // RFC estrita reprova endereco valido, que e o pior erro possivel aqui.
  if (d.from.email.trim() && !/^\S+@\S+\.\S+$/.test(d.from.email.trim()))
    e['from.email'] = 'Enter a valid email address.'
  if (d.billTo.email.trim() && !/^\S+@\S+\.\S+$/.test(d.billTo.email.trim()))
    e['billTo.email'] = 'Enter a valid email address.'

  const validos = d.items.filter(
    (i) => i.description.trim() && parseAmountToCents(i.rate) !== null,
  )
  if (validos.length === 0)
    e.items = 'Add at least one item with a description and a rate.'

  return e
}

/**
 * Vencimento antes da emissao e aviso, nao erro: retroagir data e pratica
 * contabil real e nao cabe a nos impedir.
 */
export function dueDateWarning(d: InvoiceDraft): string | null {
  if (!d.issueDate || !d.dueDate) return null
  return d.dueDate < d.issueDate
    ? 'The due date is earlier than the issue date.'
    : null
}
