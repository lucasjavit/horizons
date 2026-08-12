import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Elementos que recebem foco, para prender o Tab dentro da modal. */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal acessivel, sem dependencia.
 *
 * Nao usa <dialog> nativo de proposito: o `showModal()` precisa de ref
 * imperativo e o backdrop nativo nao aceita os tokens de cor do tema. Aqui o
 * comportamento e explicito e da para ler.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const tituloId = useId()

  useEffect(() => {
    // Guarda quem tinha o foco para devolver ao fechar: sem isso, quem
    // navega por teclado volta para o topo do documento.
    const anterior = document.activeElement as HTMLElement | null

    // Foco no primeiro CAMPO, nao no botao de fechar: a pessoa abriu a modal
    // para digitar, e o "×" vem antes no DOM.
    const campo = caixa.current?.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )
    const alvo = campo ?? caixa.current?.querySelector<HTMLElement>(FOCAVEIS)
    alvo?.focus()

    // O fundo nao pode rolar por baixo da modal.
    const overflowAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      // Prende o Tab: sem isto o foco escapa para a pagina atras da modal,
      // que continua la mesmo invisivel.
      const alvos = caixa.current?.querySelectorAll<HTMLElement>(FOCAVEIS)
      if (!alvos || alvos.length === 0) return
      const primeiro = alvos[0]
      const ultimo = alvos[alvos.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAntes
      anterior?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: 'rgb(0 0 0 / 0.5)' }}
      // Fecha ao clicar no fundo, mas so no fundo: o clique que comeca
      // dentro e termina fora nao deve fechar.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-lg rounded-xl border p-5 shadow-xl sm:p-6"
        style={{
          background: 'var(--surface-raised)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 h-9 w-9 shrink-0 rounded-md border text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
