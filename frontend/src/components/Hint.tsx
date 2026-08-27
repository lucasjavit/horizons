import { useEffect, useId, useState } from 'react'

/**
 * Quanto tempo o tooltip fica na tela antes de sumir sozinho.
 *
 * Cinco segundos: tempo de ler duas frases sem pressa, e curto o bastante para
 * o painel não ficar pendurado sobre o conteúdo quando o ponteiro parou ali
 * por acaso. Some sem fechar o foco nem o hover — só o painel sai.
 */
const SOME_APOS_MS = 5000

/** Esconde o painel depois de `SOME_APOS_MS`, reiniciando a cada reabertura. */
function useSomeSozinho(visivel: boolean, esconder: () => void): void {
  useEffect(() => {
    if (!visivel) return
    const t = setTimeout(esconder, SOME_APOS_MS)
    return () => clearTimeout(t)
    // `esconder` é estável (vem de `useState`), então o efeito só reinicia
    // quando o painel reabre — que é exatamente o momento de recontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel])
}

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
  useSomeSozinho(visivel, () => setVisivel(false))

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

/**
 * O mesmo painel do `Hint`, mas **em volta de um botão que já existe**.
 *
 * O `Hint` desenha o próprio gatilho `?`, que serve quando a explicação é
 * opcional ao lado de um rótulo. Não serve para os ícones da barra de busca:
 * ali o botão já está lá, e pendurar um `?` do lado dobraria os controles
 * numa barra que já tem seis.
 *
 * Aqui o gatilho é o `children` — o painel abre no hover e no foco do próprio
 * botão. Ele mantém o `aria-label`, que é o nome do controle; o painel entra
 * como `aria-describedby`, que é a explicação. **São coisas diferentes**: o
 * leitor de tela anuncia "Upload CV" e, em seguida, o que isso faz.
 */
export function HintWrap({
  title,
  children,
  texto,
  align = 'right',
  suprimido,
  posicao = '',
}: {
  title: string
  /** O botão que recebe o tooltip. */
  children: React.ReactNode
  /** A explicação. Uma ou duas frases; não é documentação. */
  texto: string
  align?: 'left' | 'right'
  /**
   * Não mostrar o tooltip agora.
   *
   * Serve para o botão que ABRE algo no mesmo hover: o popover de Location e a
   * etiqueta de filtros abrem ao passar o mouse, e o tooltip abria junto,
   * cobrindo o conteúdo que o gesto acabou de revelar. Explicar o botão só faz
   * sentido enquanto o que ele faz ainda não aconteceu.
   */
  suprimido?: boolean
  /**
   * Classes de POSICIONAMENTO do embrulho.
   *
   * O `HintWrap` vira o filho do flex no lugar do botão, então `order-last`,
   * `self-start` e afins param de valer se ficarem no botão de dentro —
   * medido em 27/08: a estrela e o × da linha de vaga pularam da direita para
   * o meio, entre o logo e o título. Quem embrulha herda o lugar.
   */
  posicao?: string
}) {
  const id = useId()
  const [visivel, setVisivel] = useState(false)
  const mostrar = visivel && !suprimido
  useSomeSozinho(mostrar, () => setVisivel(false))

  return (
    <span
      className={`relative inline-flex align-middle ${posicao}`}
      onMouseEnter={() => setVisivel(true)}
      onMouseLeave={() => setVisivel(false)}
      // `focus`/`blur` sobem do botão de dentro (ao contrário de
      // `focusin`/`focusout` do DOM nativo, o React os faz borbulhar), então
      // quem chega por teclado vê o mesmo painel.
      onFocus={() => setVisivel(true)}
      onBlur={() => setVisivel(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && visivel) {
          e.stopPropagation()
          setVisivel(false)
        }
      }}
    >
      <span aria-describedby={mostrar ? id : undefined} className="contents">
        {children}
      </span>

      {mostrar && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-[calc(100%+8px)] z-40 rounded-lg border p-3 text-xs leading-relaxed shadow-xl ${
            align === 'left' ? 'right-0 w-56' : 'left-0 w-56'
          }`}
          style={{
            background: 'var(--surface-raised)',
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
            // Não rouba o clique de quem mira o botão que está atrás.
            pointerEvents: 'none',
          }}
        >
          <b className="mb-1 block" style={{ color: 'var(--text)' }}>
            {title}
          </b>
          {texto}
        </span>
      )}
    </span>
  )
}
