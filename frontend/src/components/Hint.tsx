import { useId, useState } from 'react'

interface HintProps {
  /** Titulo em negrito na primeira linha. */
  title: string
  /** A explicacao. Uma ou duas frases; nao e documentacao. */
  children: string
  /**
   * Onde o painel abre. `right` e o padrao; `left` serve quando o gatilho
   * fica perto da borda direita.
   *
   * Nao ha variante para coluna estreita de proposito: tentei, e nao existe
   * largura que caiba quando o gatilho esta no meio de uma coluna de 18rem.
   * Nesse caso a explicacao vira texto na tela, nao tooltip.
   */
  align?: 'left' | 'right'
  /**
   * O texto do botao para o leitor de tela.
   *
   * O padrao, `What is {title}?`, cabe quando o titulo e um substantivo
   * ("What is Currency?"). Quando o titulo e uma frase, a pergunta sai
   * torta — dai o escape. Nao ha default vazio de proposito: icone sozinho
   * sem nome nao existe para quem nao enxerga.
   */
  label?: string
}

/**
 * Explicacao que aparece ao passar o mouse ou focar.
 *
 * Morava em `components/invoice/`, e subiu para ca em 25/08 quando a caixa de
 * curriculo da aba Jobs passou a usa-lo: nada nele e do invoice, e um segundo
 * tooltip copiado seria a mesma acessibilidade escrita duas vezes — e
 * corrigida uma so.
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
export function Hint({ title, children, align = 'right', label }: HintProps) {
  const id = useId()
  const [visivel, setVisivel] = useState(false)

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ?? `What is ${title}?`}
        aria-describedby={visivel ? id : undefined}
        aria-expanded={visivel}
        onMouseEnter={() => setVisivel(true)}
        onMouseLeave={() => setVisivel(false)}
        onFocus={() => setVisivel(true)}
        onBlur={() => setVisivel(false)}
        // **O clique nao alterna: ele garante aberto.**
        //
        // Medido pelo QA em 25/08: no celular o primeiro toque nao abria nada.
        // O gesto dispara `focus` (que abre) e `click` (que alternava para
        // fechado) — o painel abria e fechava dentro do mesmo toque, e so o
        // segundo funcionava. Como o toque so existe para ABRIR, e fechar tem
        // o Escape, o toque fora e o `blur`, alternar nao paga o preco de
        // parecer quebrado no gesto principal do celular.
        onClick={() => setVisivel(true)}
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
          className={`absolute top-[calc(100%+8px)] z-30 rounded-lg border p-3 text-xs leading-relaxed shadow-xl ${
            align === 'left' ? 'right-0 w-64' : 'left-0 w-64'
          }`}
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
