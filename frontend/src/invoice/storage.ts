import { isCurrencyCode } from './currencies'
import type { InvoiceDraft, LineItem } from './types'
import { DRAFT_VERSION, emptyDraft, emptyItem, newItemId } from './types'

const CHAVE = 'horizons.invoice.draft.v1'

/**
 * Rascunho no navegador.
 *
 * Tres coisas podem dar errado aqui, e cada uma derruba a pagina se for
 * ignorada: o localStorage lancar excecao (Safari privado, cookies
 * desativados), o JSON estar corrompido, e o formato ser de uma versao
 * anterior. Nenhuma delas pode quebrar um formulario que a pessoa esta
 * preenchendo.
 */

function saneiaItens(bruto: unknown): LineItem[] {
  if (!Array.isArray(bruto)) return [emptyItem()]

  const itens = bruto
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => ({
      // Id ausente ganha um novo: sem id estavel, o React embaralha as
      // linhas ao remover uma do meio.
      id: typeof i.id === 'string' && i.id ? i.id : newItemId(),
      description: typeof i.description === 'string' ? i.description : '',
      quantity: typeof i.quantity === 'string' ? i.quantity : '1',
      rate: typeof i.rate === 'string' ? i.rate : '',
    }))

  return itens.length > 0 ? itens : [emptyItem()]
}

export function loadDraft(): InvoiceDraft | null {
  let bruto: string | null = null
  try {
    bruto = localStorage.getItem(CHAVE)
  } catch {
    return null // storage bloqueado: segue sem rascunho, sem quebrar
  }
  if (!bruto) return null

  try {
    const salvo = JSON.parse(bruto) as Partial<InvoiceDraft>
    if (typeof salvo !== 'object' || salvo === null) return null
    if (salvo.version !== DRAFT_VERSION) return null

    const base = emptyDraft()
    return {
      ...base,
      ...salvo,
      // Objeto aninhado precisa do proprio merge: o spread raso deixaria
      // `from` sem os campos que forem adicionados depois.
      from: { ...base.from, ...salvo.from },
      billTo: { ...base.billTo, ...salvo.billTo },
      currency: isCurrencyCode(salvo.currency) ? salvo.currency : base.currency,
      items: saneiaItens(salvo.items),
      version: DRAFT_VERSION,
    }
  } catch {
    return null // JSON corrompido: comeca limpo em vez de tela branca
  }
}

export function saveDraft(draft: InvoiceDraft): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(draft))
  } catch {
    // Cota estourada ou storage bloqueado. Perder o autosave e aceitavel;
    // derrubar o formulario enquanto a pessoa digita, nao.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // mesmo motivo do saveDraft
  }
}
