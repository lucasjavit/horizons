/**
 * PLT-13 — **Jobs virou a home, e as rotas de trilha nao respondem mais.**
 *
 * As tres decisoes do card que se veem no roteador:
 *
 * 1. `/` renderiza a busca de vagas (era a listagem de trilhas).
 * 2. `/vagas` continua valendo — link antigo nao pode cair no 404.
 * 3. `/t/:slug` e `/t/:slug/:aula` nao existem: caem no "Page not found".
 *
 * ## Por que testar o `App` inteiro, e nao uma tabela de rotas exportada
 *
 * A tabela mora dentro do `App`, e extrai-la so para o teste trocaria o
 * defeito de lugar: o teste passaria a conferir a tabela que ele mesmo importa,
 * enquanto o `App` poderia registrar outra coisa. Montar o componente de
 * verdade e o que prova que a rota responde — e e o mesmo criterio do
 * `fail-closed.e2e.spec.ts` no backend: comportamento observado, nao intencao
 * declarada.
 *
 * ## O `api` e mockado, e isso nao enfraquece o teste
 *
 * O que se mede aqui e **qual pagina o caminho monta**, nao o que ela faz com
 * os dados. Sem o mock o `App` chamaria `/auth/config` e `/auth/me` de
 * verdade, e a suite passaria a depender de container no ar — falhando por
 * ambiente, e nao por defeito.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// O mock vem ANTES do import do App: ele monta a sessao no `useEffect`, e um
// `api` real tentaria rede no primeiro render.
//
// **As duas chamadas da lista entraram com o JOB-47** (01/10). Antes deste
// card, `/` sem sessao mostrava so o convite para entrar, e a `ListaVagas` nem
// era montada — o mock de dois metodos bastava. Agora a busca atende o
// anonimo, a lista monta, e ela pergunta por salvas e pelos recursos no
// `useEffect`: sem estes dois, o render estourava
// `api.listarSalvas is not a function` e o `<main>` sumia inteiro, o que
// aparecia como "heading nao encontrado" em tres testes de ROTA.
//
// As duas rejeitam como o servidor rejeita para quem nao entrou (401), que e o
// caminho que a tela ja trata: `salvas` fica `null` e a estrela nao aparece.
vi.mock('./lib/api', () => ({
  api: {
    authConfig: vi.fn().mockResolvedValue({ googleClientId: null, authDisabled: false }),
    me: vi.fn().mockRejectedValue(new Error('anonimo')),
    listarSalvas: vi.fn().mockRejectedValue(new Error('sem sessao')),
    recursosDeProduto: vi.fn().mockRejectedValue(new Error('sem sessao')),
  },
  // A lista importa `ehSemSessao` junto com o `api`: um mock de modulo
  // substitui o modulo INTEIRO, entao o que nao for declarado aqui chega
  // `undefined` e quebra na chamada.
  ehSemSessao: vi.fn().mockReturnValue(true),
}))

import App from './App'

/**
 * Monta o `App` em `caminho`.
 *
 * O `App` cria o proprio `BrowserRouter`, entao a rota se escolhe pela URL do
 * jsdom — e nao por um `MemoryRouter`, que exigiria exportar as rotas.
 */
async function abrir(caminho: string) {
  window.history.pushState({}, '', caminho)
  render(<App />)
  // O primeiro render e o "Loading…" do `conferido`: o `App` so decide a tela
  // depois de perguntar ao servidor se ha login. Esperar o conteudo e o que
  // faz o teste olhar a pagina, e nao o carregamento.
  return screen.findByRole('main', {}, { timeout: 3000 })
}

describe('PLT-13 — as rotas depois da remocao das trilhas', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('`/` monta a busca de vagas', async () => {
    await abrir('/')

    // O `<h1>` da VagasPage e "Jobs", invisivel mas no DOM (sr-only) — e o
    // identificador estavel da pagina. A barra de busca confirma que a tela
    // montou de verdade, e nao so o cromo.
    expect(await screen.findByRole('heading', { level: 1, name: /jobs/i })).toBeInTheDocument()
  })

  it('`/vagas` continua funcionando — o atalho nao caiu no 404', async () => {
    await abrir('/vagas')

    expect(await screen.findByRole('heading', { level: 1, name: /jobs/i })).toBeInTheDocument()
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument()
  })

  it.each([
    ['/t/system-design', 'a trilha'],
    ['/t/system-design/escalabilidade', 'a aula'],
  ])('%s cai no 404 (%s nao existe mais)', async (caminho) => {
    await abrir(caminho)

    // 404 e nao "uma tela vazia": a rota tem de ser desconhecida pelo
    // roteador. Se alguem devolvesse as trilhas, este `expect` e o que quebra.
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })

  it('a navegacao nao oferece Trilhas nem Tracks', async () => {
    await abrir('/')

    const nav = await screen.findByRole('navigation', { name: 'Products' })
    expect(nav).toHaveTextContent('Jobs')
    expect(nav).toHaveTextContent('Invoice')
    // Os dois nomes, porque a aba se chamou "Trilhas" antes de a interface
    // virar inglesa e "Tracks" depois.
    expect(nav).not.toHaveTextContent(/trilhas/i)
    expect(nav).not.toHaveTextContent(/tracks/i)
  })

  it('o 404 oferece a volta para a home, e nao "Back to tracks"', async () => {
    await abrir('/caminho-que-nao-existe')

    const volta = await screen.findByRole('link', { name: /back to/i })
    expect(volta).toHaveAttribute('href', '/')
    expect(volta).not.toHaveTextContent(/tracks/i)
  })
})
