import { parseAmountToCents, parseQuantity } from './money'
import type { InvoiceDraft, LineItem } from './types'

export type InvoiceErrors = Partial<Record<string, string>>

/**
 * Teto do que da para digitar em quantidade e valor unitario.
 *
 * Um milhao e um numero que faz sentido para uma pessoa, ao contrario do
 * limite de inteiro seguro do JavaScript. Vale por campo, nao pelo total:
 * dez linhas de um milhao somam dez milhoes, e isso continua permitido.
 */
export const MAX_VALOR = 1_000_000

/** Erros de uma linha, indexados por `${id}.campo`. */
export function validateItem(i: LineItem, moeda?: string): InvoiceErrors {
  const e: InvoiceErrors = {}

  const qtd = parseQuantity(i.quantity, moeda)
  if (i.quantity.trim() && qtd !== null) {
    // Maior que zero, e nao >= 1: cobrar meia hora e caso de uso real.
    if (qtd <= 0) e[`${i.id}.quantity`] = 'Quantity must be greater than zero.'
    else if (qtd > MAX_VALOR)
      e[`${i.id}.quantity`] = `Quantity must be at most ${MAX_VALOR.toLocaleString('en-US')}.`
  }

  const rate = parseAmountToCents(i.rate, moeda)
  if (i.rate.trim() && rate !== null) {
    if (rate < 0) e[`${i.id}.rate`] = 'Rate cannot be negative.'
    else if (rate > MAX_VALOR * 100)
      e[`${i.id}.rate`] = `Rate must be at most ${MAX_VALOR.toLocaleString('en-US')}.`
  }

  return e
}

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
    (i) => i.description.trim() && parseAmountToCents(i.rate, d.currency) !== null,
  )
  if (validos.length === 0)
    e.items = 'Add at least one item with a description and a rate.'

  // Erros de linha entram no mesmo mapa, com a chave `${id}.campo`, para o
  // botao de baixar bloquear enquanto houver linha invalida.
  for (const item of d.items) Object.assign(e, validateItem(item, d.currency))

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
