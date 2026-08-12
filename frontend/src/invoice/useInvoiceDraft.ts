import { useCallback, useEffect, useRef, useState } from 'react'
import { clearDraft, loadDraft, saveDraft } from './storage'
import type { CurrencyCode, InvoiceDraft, Issuer, LineItem, Party } from './types'
import { emptyDraft, emptyItem } from './types'

// Mesmo intervalo do NoteBox das aulas, para o app ter um comportamento so.
const DEBOUNCE_MS = 800

type CampoItem = 'description' | 'quantity' | 'rate'

export interface UseInvoiceDraft {
  draft: InvoiceDraft
  salvo: boolean
  setCampo: <K extends keyof InvoiceDraft>(campo: K, valor: InvoiceDraft[K]) => void
  setFrom: (campo: keyof Issuer, valor: string) => void
  setBillTo: (campo: keyof Party, valor: string) => void
  setCurrency: (moeda: CurrencyCode) => void
  setItem: (id: string, campo: CampoItem, valor: string) => void
  addItem: () => void
  removeItem: (id: string) => void
  moveItem: (id: string, direcao: -1 | 1) => void
  reset: () => void
}

export function useInvoiceDraft(): UseInvoiceDraft {
  // Le o rascunho uma vez, na primeira renderizacao.
  const [draft, setDraft] = useState<InvoiceDraft>(() => loadDraft() ?? emptyDraft())
  const [salvo, setSalvo] = useState(true)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const agendarGravacao = useCallback(() => {
    setSalvo(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      saveDraft(draftRef.current)
      setSalvo(true)
    }, DEBOUNCE_MS)
  }, [])

  // Ao sair da pagina, grava o que ficou pendente no debounce.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        saveDraft(draftRef.current)
      }
    }
  }, [])

  const alterar = useCallback(
    (fn: (d: InvoiceDraft) => InvoiceDraft) => {
      setDraft((atual) => {
        const proximo = fn(atual)
        draftRef.current = proximo
        return proximo
      })
      agendarGravacao()
    },
    [agendarGravacao],
  )

  const setCampo = useCallback<UseInvoiceDraft['setCampo']>(
    (campo, valor) => alterar((d) => ({ ...d, [campo]: valor })),
    [alterar],
  )

  const setFrom = useCallback(
    (campo: keyof Issuer, valor: string) =>
      alterar((d) => ({ ...d, from: { ...d.from, [campo]: valor } })),
    [alterar],
  )

  const setBillTo = useCallback(
    (campo: keyof Party, valor: string) =>
      alterar((d) => ({ ...d, billTo: { ...d.billTo, [campo]: valor } })),
    [alterar],
  )

  const setCurrency = useCallback(
    (moeda: CurrencyCode) => alterar((d) => ({ ...d, currency: moeda })),
    [alterar],
  )

  const setItem = useCallback(
    (id: string, campo: CampoItem, valor: string) =>
      alterar((d) => ({
        ...d,
        items: d.items.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)),
      })),
    [alterar],
  )

  const addItem = useCallback(
    () => alterar((d) => ({ ...d, items: [...d.items, emptyItem()] })),
    [alterar],
  )

  const removeItem = useCallback(
    (id: string) =>
      alterar((d) => {
        const restantes = d.items.filter((i) => i.id !== id)
        // Nunca deixa a tabela vazia: remover a ultima linha devolve uma
        // limpa, senao a pessoa fica sem caminho de volta.
        return { ...d, items: restantes.length > 0 ? restantes : [emptyItem()] }
      }),
    [alterar],
  )

  const moveItem = useCallback(
    (id: string, direcao: -1 | 1) =>
      alterar((d) => {
        const i = d.items.findIndex((it) => it.id === id)
        const destino = i + direcao
        if (i < 0 || destino < 0 || destino >= d.items.length) return d
        const items: LineItem[] = [...d.items]
        const [movido] = items.splice(i, 1)
        items.splice(destino, 0, movido)
        return { ...d, items }
      }),
    [alterar],
  )

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    const limpo = emptyDraft()
    draftRef.current = limpo
    setDraft(limpo)
    clearDraft()
    setSalvo(true)
  }, [])

  return {
    draft,
    salvo,
    setCampo,
    setFrom,
    setBillTo,
    setCurrency,
    setItem,
    addItem,
    removeItem,
    moveItem,
    reset,
  }
}
