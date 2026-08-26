import { useEffect, useRef, useState } from 'react'

/**
 * Um popover que fecha no clique fora e no Esc, **devolvendo o foco**.
 *
 * Nasceu de um bug repetido em três componentes (QA, 26/08): o Esc fechava,
 * mas se o foco estivesse DENTRO do popover ele ia para o `<body>` — e o Tab
 * seguinte recomeçava em "Skip to content", no topo da página. Quem navega por
 * teclado perdia o lugar e refazia a travessia inteira.
 *
 * Fechar com o foco no próprio botão já funcionava, o que fazia o defeito
 * passar despercebido em teste superficial.
 *
 * Não é modal e não prende o foco de propósito: sair com Tab para o próximo
 * controle é o gesto natural depois de escolher algo aqui.
 */
export function usePopover(): {
  aberto: boolean
  setAberto: (v: boolean) => void
  alternar: () => void
  /** Vai no elemento que envolve botão + painel. */
  caixa: React.RefObject<HTMLDivElement | null>
  /** Vai no botão que abre. */
  gatilho: React.RefObject<HTMLButtonElement | null>
} {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const gatilho = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    const foraDaCaixa = (e: MouseEvent) => {
      // Clique fora NÃO devolve o foco: a pessoa já apontou para onde queria
      // ir, e roubar o foco de volta atrapalharia o clique dela.
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    const noEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAberto(false)
      // Esc é gesto de teclado: o foco tem de voltar para onde estava antes de
      // abrir, que é o botão.
      gatilho.current?.focus()
    }
    document.addEventListener('mousedown', foraDaCaixa)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('mousedown', foraDaCaixa)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aberto])

  return {
    aberto,
    setAberto,
    alternar: () => setAberto(!aberto),
    caixa,
    gatilho,
  }
}
