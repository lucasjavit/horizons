import { createContext, useContext } from 'react'
import type { AuthUser } from '../types/api'

/**
 * Quem esta logado, para as paginas que precisam mudar o texto.
 *
 * Existe porque a busca e anonima: quem nunca entrou ve a lista, mas salvar
 * vaga e guardar filtro so fazem sentido com sessao — e oferecer o botao a
 * quem nao pode usar e pior que nao oferecer. E contexto, e nao props, para
 * nao atravessar App -> Routes -> pagina so para trocar uma palavra.
 *
 * `null` significa anonimo, e e um estado legitimo — nao um carregamento.
 */
export const SessaoContext = createContext<AuthUser | null>(null)

/** O usuario da sessao, ou `null` se ninguem entrou. */
export function useSessao(): AuthUser | null {
  return useContext(SessaoContext)
}
