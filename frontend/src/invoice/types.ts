/** Versao do formato do rascunho guardado no navegador. */
export const DRAFT_VERSION = 1

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'BRL' | 'CAD' | 'AUD' | 'CHF'

export interface LineItem {
  id: string
  description: string
  /**
   * Texto cru do input, nao numero.
   *
   * Um input controlado por numero nao consegue representar o que a pessoa
   * digita no meio do caminho — "", "3.", "0." — e forca as gambiarras do
   * tipo `value={n || ''}`, que brigam com o cursor. A string e a fonte da
   * verdade; o numero e derivado na hora do calculo.
   */
  quantity: string
  rate: string
}

export interface Party {
  name: string
  address: string
  email: string
}

export interface Issuer extends Party {
  taxId: string
  /** Logo em data URI, copiada da empresa salva. */
  logo?: string
}

/**
 * Uma linha dos dados de pagamento: rotulo e valor, os dois editaveis.
 *
 * Nao sao campos fixos de proposito. Quem recebe por transferencia precisa de
 * IBAN e SWIFT; quem recebe por Wise precisa so de um e-mail. Fixar seis
 * campos serviria bem a um caso e mal a todos os outros, entao o rotulo e
 * dado, nao codigo.
 */
export interface PaymentField {
  id: string
  label: string
  value: string
}

export interface InvoiceDraft {
  version: number
  invoiceNumber: string
  /** ISO 'YYYY-MM-DD', igual ao value de um <input type="date">. */
  issueDate: string
  dueDate: string
  currency: CurrencyCode
  from: Issuer
  billTo: Party
  items: LineItem[]
  /**
   * Texto livre do pagamento. Mantido para nao perder o rascunho de quem
   * escreveu antes de os campos existirem — some da tela quando vazio.
   */
  paymentDetails: string
  paymentFields: PaymentField[]
}

/**
 * Ids so precisam ser unicos dentro deste rascunho — nao vao para banco
 * nenhum. Evita `crypto.randomUUID()`, que nao existe em origem sem HTTPS
 * e quebraria o dev server acessado por IP da rede local.
 */
let contador = 0
export function newItemId(): string {
  contador += 1
  return `li-${Date.now().toString(36)}-${contador.toString(36)}`
}

/** Os rotulos que vem prontos — os da invoice internacional mais comum. */
export function defaultPaymentFields(): PaymentField[] {
  return [
    'Payment Method',
    'IBAN',
    'Beneficiary Name',
    'Beneficiary Address',
    'SWIFT Code',
    'Bank',
    'Bank Address',
  ].map((label) => ({ id: newItemId(), label, value: '' }))
}

export function emptyItem(): LineItem {
  return { id: newItemId(), description: '', quantity: '1', rate: '' }
}

/** Data de hoje em ISO, no fuso local (nao em UTC, que erra o dia a noite). */
export function todayIso(): string {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

export function emptyDraft(): InvoiceDraft {
  return {
    version: DRAFT_VERSION,
    invoiceNumber: '',
    issueDate: todayIso(),
    dueDate: '',
    currency: 'USD',
    from: { name: '', address: '', email: '', taxId: '' },
    billTo: { name: '', address: '', email: '' },
    items: [emptyItem()],
    paymentDetails: '',
    paymentFields: defaultPaymentFields(),
  }
}
