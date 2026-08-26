import { useCallback, useEffect, useState } from 'react'

/**
 * O tema escolhido, e o que ele significa.
 *
 * **`sistema` não é um terceiro visual** — é a ausência de escolha, e deixa o
 * `prefers-color-scheme` decidir. É o estado em que todo mundo esteve até
 * agora, e continua sendo o padrão: quem nunca clicou no botão não deve ver
 * nada mudar.
 */
export type Tema = 'claro' | 'escuro' | 'sistema'

const CHAVE = 'horizons.tema'

/**
 * Aplica o tema no `<html>`.
 *
 * O CSS já está preparado (`src/index.css`): `:root[data-theme='dark']` e
 * `:root:not([data-theme='light'])` com a media query dentro. Escrever o
 * atributo é tudo o que falta — em `sistema`, ele é REMOVIDO, e não posto como
 * `"system"`, senão a media query nunca voltaria a valer.
 */
function aplicar(tema: Tema): void {
  const raiz = document.documentElement
  if (tema === 'sistema') raiz.removeAttribute('data-theme')
  else raiz.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light')
}

/** Lê a escolha guardada. Storage pode lançar (janela privada, cookies off). */
function lerGuardado(): Tema {
  try {
    const v = localStorage.getItem(CHAVE)
    if (v === 'claro' || v === 'escuro' || v === 'sistema') return v
  } catch {
    // Ignora: sem storage a pessoa fica no tema do sistema, que é o padrão.
  }
  return 'sistema'
}

/**
 * O tema e como trocá-lo.
 *
 * Cicla `sistema → claro → escuro → sistema`. Três estados e não dois porque
 * "seguir o sistema" é uma escolha legítima — e a única forma de voltar a ela
 * depois de ter clicado seria limpar o storage à mão.
 */
export function useTema(): { tema: Tema; alternar: () => void } {
  const [tema, setTema] = useState<Tema>(lerGuardado)

  useEffect(() => {
    aplicar(tema)
    try {
      if (tema === 'sistema') localStorage.removeItem(CHAVE)
      else localStorage.setItem(CHAVE, tema)
    } catch {
      // Sem storage a escolha vale só nesta aba. Melhor que não funcionar.
    }
  }, [tema])

  const alternar = useCallback(() => {
    setTema((t) => (t === 'sistema' ? 'claro' : t === 'claro' ? 'escuro' : 'sistema'))
  }, [])

  return { tema, alternar }
}

/**
 * Aplica o tema guardado ANTES do React montar.
 *
 * Chamado de `main.tsx`. Sem isto há um flash: a página pinta no tema do
 * sistema e só depois o React corrige, o que pisca branco para quem escolheu
 * escuro.
 */
export function aplicarTemaInicial(): void {
  aplicar(lerGuardado())
}
