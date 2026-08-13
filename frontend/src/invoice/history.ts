import type { InvoiceDraft } from './types'
import { newItemId } from './types'

/**
 * Historico local das invoices baixadas.
 *
 * Guarda no navegador, como o rascunho e as empresas. Nao substitui o
 * historico com login (INV-10) — os dois vao coexistir: este e o que funciona
 * hoje, sem cadastro, para quem so quer achar de novo a fatura do mes passado.
 *
 * Cabem ~9.000 invoices em 5 MB (medido: 578 bytes cada). O limite pratico
 * nao e o espaco, e o navegador ser limpo ou trocado — e a tela diz isso.
 */

const CHAVE = 'horizons.invoice.history.v1'

/** Teto de registros. O corte e por seguranca, nao por espaco. */
const MAX = 200

export interface HistoryEntry {
  id: string
  /** Quando entrou no historico, em ISO. */
  savedAt: string
  draft: InvoiceDraft
}

function ler(): HistoryEntry[] {
  let bruto: string | null = null
  try {
    bruto = localStorage.getItem(CHAVE)
  } catch {
    return []
  }
  if (!bruto) return []
  try {
    const lista = JSON.parse(bruto) as unknown
    if (!Array.isArray(lista)) return []
    return lista.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as HistoryEntry).id === 'string' &&
        typeof (e as HistoryEntry).draft === 'object',
    )
  } catch {
    return []
  }
}

function gravar(lista: HistoryEntry[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAX)))
  } catch {
    // Cota estourada ou storage bloqueado: perder o historico e ruim, mas
    // travar quem esta baixando uma fatura e pior.
  }
}

export function loadHistory(): HistoryEntry[] {
  return ler()
}

/**
 * O que define se duas invoices sao "a mesma".
 *
 * Compara o conteudo, ignorando o que nao vai para o documento. E isto que
 * faz baixar de novo sem mudar nada NAO criar registro repetido, enquanto
 * abrir a do mes passado, trocar o periodo e baixar cria um novo.
 */
function assinatura(d: InvoiceDraft): string {
  return JSON.stringify({
    n: d.invoiceNumber.trim(),
    e: d.issueDate,
    v: d.dueDate,
    m: d.currency,
    f: d.from,
    b: d.billTo,
    i: d.items.map((x) => [x.description.trim(), x.quantity, x.rate]),
    p: d.paymentFields.map((x) => [x.label.trim(), x.value.trim()]),
  })
}

/**
 * Registra a invoice baixada e devolve o historico novo.
 *
 * Se o conteudo for identico ao de um registro existente, nao duplica — so
 * traz aquele para o topo, porque foi usado de novo.
 */
export function recordDownload(draft: InvoiceDraft): HistoryEntry[] {
  const lista = ler()
  const assin = assinatura(draft)
  const iguais = lista.findIndex((e) => assinatura(e.draft) === assin)

  if (iguais >= 0) {
    const [existente] = lista.splice(iguais, 1)
    const atualizado = { ...existente, savedAt: new Date().toISOString() }
    const nova = [atualizado, ...lista]
    gravar(nova)
    return nova
  }

  const nova = [
    {
      id: newItemId(),
      savedAt: new Date().toISOString(),
      // Copia profunda: sem isso o registro seguiria mudando junto com o
      // rascunho que a pessoa continua editando.
      draft: JSON.parse(JSON.stringify(draft)) as InvoiceDraft,
    },
    ...lista,
  ]
  gravar(nova)
  return nova
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const nova = ler().filter((e) => e.id !== id)
  gravar(nova)
  return nova
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // mesmo motivo do gravar
  }
}
