import type { ReactNode } from 'react'

interface RecolhivelProps {
  /** Aberto ou fechado. */
  aberto: boolean
  /** Liga o painel ao botao que o controla (`aria-controls`). */
  id?: string
  /** Em que direcao desliza. */
  eixo?: 'vertical' | 'horizontal'
  children: ReactNode
}

/**
 * Conteudo que desliza ao abrir e fechar.
 *
 * O truque e `grid-template-rows` de `0fr` para `1fr`: anima a altura sem
 * precisar medir o conteudo em JavaScript, e sem `max-height` chutado —
 * altura fixa ou corta o conteudo grande, ou deixa a animacao lenta demais
 * no conteudo pequeno.
 *
 * Nasceu no painel de historico da invoice e virou componente quando o mesmo
 * comportamento foi pedido para a previa. Use sempre que algo abrir e fechar.
 *
 * Tres detalhes que sao facil de esquecer e caros de descobrir depois:
 *
 * - o filho precisa de `overflow-hidden`, senao o conteudo vaza durante a
 *   transicao em vez de ser revelado aos poucos;
 * - fechado, recebe `inert`, senao o Tab para em controles invisiveis de
 *   altura zero;
 * - respeita `prefers-reduced-motion`, porque animacao de layout incomoda
 *   quem tem sensibilidade a movimento.
 */
export function Recolhivel({
  aberto,
  id,
  eixo = 'vertical',
  children,
}: RecolhivelProps) {
  const fecha =
    eixo === 'vertical'
      ? aberto
        ? 'grid-rows-[1fr]'
        : 'grid-rows-[0fr]'
      : aberto
        ? 'grid-cols-[1fr]'
        : 'grid-cols-[0fr]'

  return (
    <div
      id={id}
      aria-hidden={!aberto}
      className={`grid transition-all duration-500 ease-out motion-reduce:transition-none ${fecha} ${
        aberto ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="overflow-hidden" inert={!aberto}>
        {children}
      </div>
    </div>
  )
}
