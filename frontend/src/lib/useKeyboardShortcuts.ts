import { useEffect } from 'react'

type Handlers = Record<string, () => void>

/** Digitar num campo não pode disparar atalho — senão escrever "c" numa
 *  anotação marcaria a aula como concluída. */
function editando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  const tag = alvo.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    alvo.isContentEditable
  )
}

/**
 * Atalhos de teclado por tecla única (`j`, `k`, `c`, `/`).
 * O objeto `handlers` é lido a cada evento, então não precisa ser estável.
 */
export function useKeyboardShortcuts(handlers: Handlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Combinações com modificador pertencem ao navegador e ao sistema.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (editando(e.target)) return

      const fn = handlers[e.key.toLowerCase()]
      if (!fn) return
      e.preventDefault()
      fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
