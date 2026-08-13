import type { AuthUser } from '../types/api'

const CHAVE = 'horizons.token'

/**
 * Token da sessao, onde um F5 consegue encontrar de novo.
 *
 * `localStorage` e a mesma escolha do arguicao, e tem o mesmo custo: um XSS
 * le o token. A defesa que temos e o backend reler o usuario a cada request,
 * entao desativar a conta corta a sessao na hora. Cookie httpOnly seria
 * melhor e fica registrado como divida.
 */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(CHAVE)
    } catch {
      return null
    }
  },
  set(t: string): void {
    try {
      localStorage.setItem(CHAVE, t)
    } catch {
      // storage bloqueado: a sessao vale so ate a aba fechar
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(CHAVE)
    } catch {
      // idem
    }
  },
}

/** Quem quer saber que a sessao caiu (o App volta para a tela de login). */
const ouvintes: (() => void)[] = []

export function aoPerderSessao(fn: () => void): () => void {
  ouvintes.push(fn)
  return () => {
    const i = ouvintes.indexOf(fn)
    if (i >= 0) ouvintes.splice(i, 1)
  }
}

export function perdeuSessao(): void {
  tokenStore.clear()
  ouvintes.forEach((fn) => fn())
}

export type { AuthUser }
