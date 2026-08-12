import { useEffect } from 'react'

const BASE = 'Horizons'

/**
 * Ajusta o título da aba por rota. Passe `null` enquanto os dados carregam
 * para manter o título anterior em vez de piscar um valor provisório.
 */
export function useDocumentTitle(titulo: string | null): void {
  useEffect(() => {
    if (!titulo) return
    document.title = `${titulo} · ${BASE}`
    return () => {
      document.title = BASE
    }
  }, [titulo])
}
