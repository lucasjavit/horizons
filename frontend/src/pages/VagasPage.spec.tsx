/**
 * JOB-47 — **a busca aparece sem login; a aba Saved e que pede sessao.**
 *
 * A `VagasPage` tomava UMA decisao antes deste card — `sessao ? lista :
 * convite` — e agora toma outra: a lista monta para todo mundo, e o convite
 * cobre so `/vagas/saved`. Este arquivo existe porque essa inversao e o tipo
 * de mudanca que se desfaz sozinha num merge, sem quebrar nada visivel: a tela
 * volta a pedir login, e ninguem nota ate alguem abrir o site sem estar
 * logado.
 *
 * ## O que e dublado
 *
 * A `ListaVagas` inteira, por um marcador. O que se mede aqui e **qual dos
 * dois a pagina escolhe**, e montar a lista de verdade traria os dois
 * `useEffect` de carga dela para dentro de um teste que nao fala sobre isso —
 * ela tem o proprio arquivo, com 36 provas.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessaoContext } from '../lib/sessao'
import type { AuthUser } from '../types/api'

vi.mock('../components/vagas/ListaVagas', () => ({
  // Recebe `verSalvas` para o teste poder provar que a pagina repassa o modo,
  // e nao so que montou alguma coisa.
  ListaVagas: ({ verSalvas }: { verSalvas?: boolean }) => (
    <div data-testid="lista-vagas">{verSalvas ? 'saved' : 'search'}</div>
  ),
}))

// O botao do Google fala com a rede no `useEffect` (carrega o SDK). O que
// importa ao teste e que o convite OFERECE como entrar.
vi.mock('../components/BotaoGoogle', () => ({
  BotaoGoogle: () => <button type="button">Sign in with Google</button>,
}))

const { VagasPage } = await import('./VagasPage')

const USUARIO: AuthUser = {
  id: 'u1',
  email: 'quem@entrou.com',
  name: 'Quem Entrou',
  avatarUrl: null,
  role: 'COMMON_USER',
}

/** Monta a pagina com ou sem sessao. `null` e o default do contexto: anonimo. */
function montar({ usuario = null, salvas = false }: { usuario?: AuthUser | null; salvas?: boolean } = {}) {
  render(
    <SessaoContext.Provider value={usuario}>
      <VagasPage salvas={salvas} />
    </SessaoContext.Provider>,
  )
}

describe('VagasPage — a busca sem login (JOB-47)', () => {
  it('anonimo em `/` ve a BUSCA, e nao um convite para entrar', () => {
    montar()

    // O criterio de aceite 1 do card, na tela: sem token, a busca aparece.
    expect(screen.getByTestId('lista-vagas').textContent).toBe('search')
    expect(screen.queryByText(/Sign in to save jobs/i)).toBeNull()
  });

  it('quem entrou tambem ve a busca — nada mudou para ele', () => {
    montar({ usuario: USUARIO })

    expect(screen.getByTestId('lista-vagas').textContent).toBe('search')
  });

  it('anonimo na aba Saved recebe o convite, e nao um erro', () => {
    montar({ salvas: true })

    // **"Sign in to save jobs", e nao "Unauthorized"** — criterio 6 do card. O
    // texto diz o que a conta acrescenta.
    expect(screen.getByRole('heading', { name: /Sign in to save jobs/i })).toBeTruthy()
    expect(screen.queryByTestId('lista-vagas')).toBeNull()
  });

  it('o convite da aba Saved explica que BUSCAR nao precisa de conta', () => {
    montar({ salvas: true })

    // E a frase que impede o convite de parecer um muro: quem caiu aqui por
    // engano precisa saber que a busca esta aberta.
    expect(screen.getByText(/Searching needs no account/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeTruthy()
  });

  it('quem entrou ve a LISTA de salvas, no modo salvas', () => {
    montar({ usuario: USUARIO, salvas: true })

    expect(screen.getByTestId('lista-vagas').textContent).toBe('saved')
    expect(screen.queryByText(/Sign in to save jobs/i)).toBeNull()
  });

  it('a pagina continua cumprindo o contrato do skip link', () => {
    // `<main id="conteudo" tabIndex={-1}>` e o destino do skip link do
    // `App.tsx` (CLAUDE.md). Vale nos dois caminhos, e o convite e um deles.
    montar({ salvas: true })

    const main = screen.getByRole('main')
    expect(main.id).toBe('conteudo')
    expect(main.getAttribute('tabindex')).toBe('-1')
  });
});
