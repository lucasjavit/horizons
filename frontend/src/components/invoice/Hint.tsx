import { useId, useState } from 'react'

interface HintProps {
  /** Titulo em negrito na primeira linha. */
  title: string
  /** A explicacao. Uma ou duas frases; nao e documentacao. */
  children: string
}

/**
 * Explicacao que aparece ao passar o mouse ou focar.
 *
 * Copiado do padrao do look4job (`.pill .tip` no index.html) e adaptado aos
 * tokens do Horizons. O que foi mantido de la: o atraso antes de aparecer,
 * para nao piscar quando o mouse so passa de raspao; o titulo em negrito
 * acima da explicacao; e `pointer-events: none`, para o painel nao roubar o
 * clique de quem mira o que esta atras.
 *
 * O que foi corrigido: o original abre so no `:hover`, entao nao existe para
 * quem navega por teclado. Aqui o gatilho e um `<button>` que tambem responde
 * a foco, com `aria-describedby` ligando o texto ao botao — assim o leitor de
 * tela le a explicacao, e nao so o icone.
 */
export function Hint({ title, children }: HintProps) {
  const id = useId()
  const [visivel, setVisivel] = useState(false)

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`What is ${title}?`}
        aria-describedby={visivel ? id : undefined}
        aria-expanded={visivel}
        onMouseEnter={() => setVisivel(true)}
        onMouseLeave={() => setVisivel(false)}
        onFocus={() => setVisivel(true)}
        onBlur={() => setVisivel(false)}
        // Toque: no celular nao ha hover, entao o clique alterna.
        onClick={() => setVisivel((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && visivel) {
            e.stopPropagation()
            setVisivel(false)
          }
        }}
        // 24px de alvo, o minimo da WCAG 2.5.8, mesmo o glifo sendo pequeno.
        className="flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem] font-bold"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
          background: 'var(--surface-sunken)',
        }}
      >
        <span aria-hidden>?</span>
      </button>

      {visivel && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-64 rounded-lg border p-3 text-xs leading-relaxed shadow-xl"
          style={{
            background: 'var(--surface-raised)',
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
            // Nao rouba o clique de quem mira o que esta atras.
            pointerEvents: 'none',
          }}
        >
          <b className="mb-1 block" style={{ color: 'var(--text)' }}>
            {title}
          </b>
          {children}
        </span>
      )}
    </span>
  )
}
