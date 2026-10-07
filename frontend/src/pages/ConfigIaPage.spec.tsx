/**
 * JOB-57 — **chave que ja existe tambem se troca.**
 *
 * O campo de chave so aparecia para provedor sem chave ou com chave recusada.
 * Chave funcionando, sem cota ou com erro ficava sem campo E sem `Remove`
 * (que mora dentro do formulario): nao havia como atualiza-la pela tela.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ProvedorIa, Recursos, StatusDaChave } from '../types/api'

const mockApi = vi.hoisted(() => ({
  recursos: vi.fn(),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  moverProvedor: vi.fn(),
  verificarChaves: vi.fn(),
}))

vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof import('../lib/api')>()),
  api: mockApi,
}))

const { ConfigIaPage } = await import('./ConfigIaPage')

function provedor(
  id: string,
  nome: string,
  status: StatusDaChave,
  buscaWeb: boolean,
): ProvedorIa {
  return {
    id,
    nome,
    temChave: status !== 'sem_chave',
    buscaWeb,
    treinaComOsDados: false,
    console: 'console.example.com',
    gratuito: !buscaWeb,
    status,
    httpStatus: null,
    motivo: '',
    checkedAt: null,
    hint: status === 'sem_chave' ? null : 'ab12',
  } as unknown as ProvedorIa
}

function recursos(provedores: ProvedorIa[]): Recursos {
  return { provedores, iaDaBusca: null, iaDaExtracao: null } as unknown as Recursos
}

const PADRAO = [
  provedor('ANTHROPIC', 'Claude (Anthropic)', 'funcionando', true),
  provedor('OPENAI', 'ChatGPT (OpenAI)', 'sem_cota', true),
  provedor('GEMINI', 'Gemini (Google)', 'chave_recusada', true),
  provedor('GROQ', 'Groq (Llama 3.3)', 'sem_chave', false),
  provedor('MISTRAL', 'Mistral', 'funcionando', false),
]

async function montar() {
  render(
    <MemoryRouter>
      <ConfigIaPage />
    </MemoryRouter>,
  )
  // Espera pelo dado, e nao pelo no: o botao so existe depois da carga.
  await screen.findAllByRole('button', { name: 'Update key for Claude (Anthropic)' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.recursos.mockResolvedValue(recursos(PADRAO))
  mockApi.setToken.mockResolvedValue(undefined)
  mockApi.removeToken.mockResolvedValue(undefined)
})

/** A linha de um provedor numa das duas cadeias (a ordem do DOM e busca, leitura). */
function linhas(nome: string): HTMLElement[] {
  return screen
    .getAllByText(nome, { selector: 'span' })
    .map((el) => el.closest('li') as HTMLElement)
}

describe('ConfigIaPage — o CRUD da chave vale para todo provedor (JOB-57)', () => {
  it('toda linha com chave tem `Update key` e `Remove key`, nas duas cadeias', async () => {
    await montar()
    // Busca na web: duas linhas (as duas cadeias). Mistral: so a de leitura.
    const esperado: Array<[string, number]> = [
      ['Claude (Anthropic)', 2],
      ['ChatGPT (OpenAI)', 2],
      ['Mistral', 1],
    ]
    for (const [nome, vezes] of esperado) {
      expect(linhas(nome)).toHaveLength(vezes)
      for (const linha of linhas(nome)) {
        within(linha).getByRole('button', { name: `Update key for ${nome}` })
        within(linha).getByRole('button', { name: `Remove key for ${nome}` })
      }
    }
  })

  it('chave recusada: campo ja aberto, e `Remove key` ao lado — sem `Update key`', async () => {
    await montar()
    for (const linha of linhas('Gemini (Google)')) {
      within(linha).getByLabelText('Replace key')
      within(linha).getByRole('button', { name: 'Remove key for Gemini (Google)' })
      expect(within(linha).queryByRole('button', { name: /Update key/ })).toBeNull()
    }
  })

  it('sem chave: so o campo de cadastrar — nao ha o que atualizar nem remover', async () => {
    await montar()
    const [linha] = linhas('Groq (Llama 3.3)')
    within(linha).getByLabelText('Key')
    expect(within(linha).queryByRole('button', { name: /Update key|Remove key/ })).toBeNull()
  })

  it('o campo da chave que funciona nasce fechado', async () => {
    await montar()
    for (const linha of linhas('Claude (Anthropic)')) {
      expect(within(linha).queryByLabelText('Replace key')).toBeNull()
    }
  })

  it('`Update key` abre o campo, salva a chave nova e fecha', async () => {
    const usuario = userEvent.setup()
    await montar()

    // A linha da cadeia de LEITURA: e a que nao tinha botao nenhum.
    const linha = linhas('ChatGPT (OpenAI)')[1]
    const botao = within(linha).getByRole('button', { name: 'Update key for ChatGPT (OpenAI)' })
    expect(botao).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(botao)

    await usuario.type(within(linha).getByLabelText('Replace key'), '  sk-nova-123  ')
    await usuario.click(within(linha).getByRole('button', { name: 'Save and test' }))

    expect(mockApi.setToken).toHaveBeenCalledWith('OPENAI', 'sk-nova-123')
    expect(
      await within(linha).findByRole('button', { name: 'Update key for ChatGPT (OpenAI)' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(within(linha).queryByLabelText('Replace key')).toBeNull()
  })

  it('`Cancel` fecha sem salvar e joga fora o que foi digitado', async () => {
    const usuario = userEvent.setup()
    await montar()

    const [linha] = linhas('Mistral')
    await usuario.click(within(linha).getByRole('button', { name: 'Update key for Mistral' }))
    await usuario.type(within(linha).getByLabelText('Replace key'), 'rascunho')
    await usuario.click(within(linha).getByRole('button', { name: 'Cancel for Mistral' }))

    expect(mockApi.setToken).not.toHaveBeenCalled()
    await usuario.click(within(linha).getByRole('button', { name: 'Update key for Mistral' }))
    expect(within(linha).getByLabelText('Replace key')).toHaveValue('')
  })

  it('remover pede confirmacao: um clique so NAO apaga a chave', async () => {
    const usuario = userEvent.setup()
    await montar()

    const [linha] = linhas('Claude (Anthropic)')
    await usuario.click(
      within(linha).getByRole('button', { name: 'Remove key for Claude (Anthropic)' }),
    )
    expect(mockApi.removeToken).not.toHaveBeenCalled()

    await usuario.click(within(linha).getByRole('button', { name: 'Keep key' }))
    expect(mockApi.removeToken).not.toHaveBeenCalled()
    within(linha).getByRole('button', { name: 'Remove key for Claude (Anthropic)' })
  })

  it('confirmar remove a chave — inclusive a que funciona', async () => {
    const usuario = userEvent.setup()
    await montar()

    const [linha] = linhas('Claude (Anthropic)')
    await usuario.click(
      within(linha).getByRole('button', { name: 'Remove key for Claude (Anthropic)' }),
    )
    await usuario.click(
      within(linha).getByRole('button', {
        name: 'Confirm removal of the Claude (Anthropic) key',
      }),
    )
    expect(mockApi.removeToken).toHaveBeenCalledWith('ANTHROPIC')
  })
})
