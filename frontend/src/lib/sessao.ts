import { createContext, useContext } from 'react'
import type { AuthUser } from '../types/api'

/**
 * Quem esta logado, para as paginas que precisam mudar o texto.
 *
 * Existe porque a leitura passou a ser anonima: "Suas trilhas" e um titulo
 * errado para quem nunca entrou, e o progresso so e "seu" depois da sessao.
 * E contexto, e nao props, para nao atravessar App -> Routes -> pagina so
 * para trocar uma palavra.
 *
 * `null` significa anonimo, e e um estado legitimo — nao um carregamento.
 */
export const SessaoContext = createContext<AuthUser | null>(null)

/** O usuario da sessao, ou `null` se ninguem entrou. */
export function useSessao(): AuthUser | null {
  return useContext(SessaoContext)
}
