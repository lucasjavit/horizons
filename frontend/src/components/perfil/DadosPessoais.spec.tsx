/**
 * Camada 4 — `DadosPessoais`.
 *
 * Os dois casos que o card QA-03 nomeia, e o motivo de cada um:
 *
 * - **Trocar de país revalida o documento.** O que estava digitado foi pensado
 *   para outra regra: um CPF não é um NIF. Manter o valor faria a tela aceitar
 *   em silêncio um documento que o servidor vai recusar — e o aviso sobre o
 *   documento JÁ SALVO ("no longer applies") é o que o card de 31/08 cobrou,
 *   quando "Not set" deixava o documento órfão sem dizer nada.
 * - **Falha de rede não perde o que foi digitado.** É a regra escrita no
 *   `catch` do componente: a pessoa corrige a conexão e clica Save de novo. Um
 *   formulário que se limpa no erro obriga a redigitar tudo, e o erro de rede é
 *   justamente o mais comum.
 *
 * A `api` é dublada por inteiro: este é teste de componente, e falar com o
 * backend de verdade o tornaria lento e dependente de estado que outro teste
 * criou — as duas coisas que o card proíbe.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Pais, PerfilPessoal } from '../../types/api'

// O mock precisa existir ANTES do import do componente, porque ele captura
// `api` no topo do módulo. `vi.mock` é içado pelo Vitest, então a ordem no
// arquivo não engana — mas as funções vivem num objeto para os testes poderem
// trocar o comportamento uma a uma.
const mockApi = {
  meuPerfil: vi.fn(),
  paises: vi.fn(),
  salvarPerfil: vi.fn(),
}

vi.mock('../../lib/api', () => ({
  api: mockApi,
  // `errorMessage` é usada pelo componente E pelo `useAsync`; a versão real
  // desembrulha erro do axios, e aqui a mensagem já vem pronta.
  errorMessage: (e: unknown) =>
    typeof e === 'object' && e && 'message' in e ? String((e as Error).message) : String(e),
}))

const { DadosPessoais } = await import('./DadosPessoais')

const PAISES: Pais[] = [
  { codigo: 'BR', nome: 'Brazil', ddi: '55', documento: 'CPF', exemplo: '123.456.789-09', validado: true },
  { codigo: 'PT', nome: 'Portugal', ddi: '351', documento: 'NIF', exemplo: '123456789', validado: true },
]

const ENDERECO_VAZIO = {
  street: null,
  number: null,
  complement: null,
  district: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
}

function perfil(over: Partial<PerfilPessoal> = {}): PerfilPessoal {
  return {
    country: null,
    phone: null,
    documentHint: null,
    documentCountry: null,
    address: ENDERECO_VAZIO,
    ...over,
  } as PerfilPessoal
}

/**
 * Renderiza e espera o formulário estar **assentado**.
 *
 * ⚠️ Esperar só o `<select>` aparecer NÃO basta, e isso custou uma rodada de
 * testes intermitentes: o componente monta o formulário assim que o `useAsync`
 * resolve, mas quem aplica o perfil ao estado é um `useEffect` que roda
 * DEPOIS. Entre os dois há um render em que o país ainda é `''` — e ali o
 * rótulo do documento é "Document", não "CPF".
 *
 * O sintoma foi um teste que falhava ora aqui, ora ali, conforme o
 * escalonamento: sinal de corrida, e não de defeito no componente. Por isso a
 * espera é pelo VALOR do select, que é o que o `useEffect` grava.
 *
 * @param paisEsperado o código que o perfil dublado traz, ou `''` para "Not set".
 */
async function renderizar(paisEsperado = '') {
  render(<DadosPessoais />)
  const select = await screen.findByLabelText('Where you live')
  await waitFor(() => expect(select).toHaveValue(paisEsperado))
  return select
}

describe('DadosPessoais', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.paises.mockResolvedValue(PAISES)
    mockApi.meuPerfil.mockResolvedValue(perfil())
    mockApi.salvarPerfil.mockResolvedValue(perfil())
  })

  describe('trocar de país revalida o documento', () => {
    it('limpa o que estava digitado — a regra do país anterior não vale mais', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      await renderizar('BR')

      const doc = screen.getByLabelText('CPF')
      await userEvent.type(doc, '123.456.789-09')
      expect(doc).toHaveValue('123.456.789-09')

      await userEvent.selectOptions(screen.getByLabelText('Where you live'), 'PT')

      // Um CPF não é um NIF: manter o valor faria a tela aceitar em silêncio o
      // que o servidor vai recusar.
      expect(screen.getByLabelText('NIF')).toHaveValue('')
    })

    it('o rótulo do campo acompanha o país', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      await renderizar('BR')

      expect(screen.getByLabelText('CPF')).toBeTruthy()

      await userEvent.selectOptions(screen.getByLabelText('Where you live'), 'PT')

      expect(screen.getByLabelText('NIF')).toBeTruthy()
      expect(screen.queryByLabelText('CPF')).toBeNull()
    })

    it('avisa que o documento JÁ SALVO não se aplica mais (QA 31/08)', async () => {
      // O bug que o card nomeia: trocar o país deixava o documento guardado
      // órfão, e a tela não dizia nada. "Saved" ao lado de um documento que
      // não vale mais é mentira.
      mockApi.meuPerfil.mockResolvedValue(
        perfil({ country: 'BR', documentHint: '789-09', documentCountry: 'BR' }),
      )
      await renderizar('BR')

      expect(screen.queryByText(/no longer applies/i)).toBeNull()

      await userEvent.selectOptions(screen.getByLabelText('Where you live'), 'PT')

      expect(screen.getByText(/no longer applies/i)).toBeTruthy()
    })

    it('voltar ao país original faz o aviso sumir', async () => {
      // O contrapositivo: um aviso que nunca sai diria que o documento está
      // obsoleto mesmo depois de a pessoa desfazer a troca.
      mockApi.meuPerfil.mockResolvedValue(
        perfil({ country: 'BR', documentHint: '789-09', documentCountry: 'BR' }),
      )
      await renderizar('BR')

      await userEvent.selectOptions(screen.getByLabelText('Where you live'), 'PT')
      expect(screen.getByText(/no longer applies/i)).toBeTruthy()

      await userEvent.selectOptions(screen.getByLabelText('Where you live'), 'BR')
      expect(screen.queryByText(/no longer applies/i)).toBeNull()
    })

    it('sem país escolhido, o campo de documento fica desabilitado', async () => {
      // Pedir "Document" sem saber o país não permite validar nada, e o
      // placeholder explica o que fazer em vez de deixar o campo mudo.
      await renderizar()

      expect(screen.getByLabelText('Document')).toBeDisabled()
    })
  })

  describe('falha de rede não perde o que foi digitado', () => {
    it('o telefone e o documento continuam na tela depois do erro', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      mockApi.salvarPerfil.mockRejectedValue(new Error('Network Error'))
      await renderizar('BR')

      await userEvent.type(screen.getByLabelText('Phone'), '+55 11 91234 5678')
      await userEvent.type(screen.getByLabelText('CPF'), '123.456.789-09')

      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await screen.findByRole('alert')
      // ⚠️ O ponto do teste. Um formulário que se limpa no erro obriga a
      // redigitar tudo — e erro de rede é o mais comum de todos.
      expect(screen.getByLabelText('Phone')).toHaveValue('+55 11 91234 5678')
      expect(screen.getByLabelText('CPF')).toHaveValue('123.456.789-09')
    })

    it('o endereço digitado também sobrevive', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      mockApi.salvarPerfil.mockRejectedValue(new Error('Network Error'))
      await renderizar('BR')

      await userEvent.type(screen.getByLabelText('Street'), 'Rua das Flores')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await screen.findByRole('alert')
      expect(screen.getByLabelText('Street')).toHaveValue('Rua das Flores')
    })

    it('a mensagem do erro de rede aparece', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      mockApi.salvarPerfil.mockRejectedValue(new Error('Network Error'))
      await renderizar('BR')

      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Network Error')
    })
  })

  describe('o 400 do documento é erro de CAMPO, e não alerta geral', () => {
    it('marca aria-invalid no input do documento', async () => {
      // Erro sinalizado por borda + `aria-invalid` + texto, nunca só cor
      // (CLAUDE.md). E no input certo: pendurá-lo no lugar errado mandaria a
      // pessoa corrigir o campo que estava bom.
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      const erro = Object.assign(new Error('CPF invalido'), {
        response: { status: 400 },
      })
      mockApi.salvarPerfil.mockRejectedValue(erro)
      await renderizar('BR')

      await userEvent.type(screen.getByLabelText('CPF'), '111')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByLabelText('CPF')).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('digitar de novo limpa o erro — a correção precisa parecer que adiantou', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      const erro = Object.assign(new Error('CPF invalido'), {
        response: { status: 400 },
      })
      mockApi.salvarPerfil.mockRejectedValue(erro)
      await renderizar('BR')

      const doc = screen.getByLabelText('CPF')
      await userEvent.type(doc, '111')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))
      await waitFor(() => expect(doc).toHaveAttribute('aria-invalid', 'true'))

      await userEvent.type(doc, '2')

      expect(doc).not.toHaveAttribute('aria-invalid')
    })
  })

  describe('o que é enviado ao salvar', () => {
    it('NÃO manda o documento quando o campo está vazio', async () => {
      // Mandar `''` apagaria o documento guardado a cada Save de telefone —
      // a pessoa perderia o CPF por trocar o telefone.
      mockApi.meuPerfil.mockResolvedValue(
        perfil({ country: 'BR', documentHint: '789-09', documentCountry: 'BR' }),
      )
      await renderizar('BR')

      await userEvent.type(screen.getByLabelText('Phone'), '+55 11 90000 0000')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(mockApi.salvarPerfil).toHaveBeenCalled())
      const enviado = mockApi.salvarPerfil.mock.calls[0][0]
      expect(enviado).not.toHaveProperty('document')
      expect(enviado.phone).toBe('+55 11 90000 0000')
    })

    it('manda o documento quando a pessoa digitou um', async () => {
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      await renderizar('BR')

      await userEvent.type(screen.getByLabelText('CPF'), '123.456.789-09')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(mockApi.salvarPerfil).toHaveBeenCalled())
      expect(mockApi.salvarPerfil.mock.calls[0][0].document).toBe('123.456.789-09')
    })

    it('o campo do documento esvazia depois de salvar', async () => {
      // O valor não volta do servidor; deixá-lo preenchido daria a impressão
      // de que a tela o leu de lá.
      mockApi.meuPerfil.mockResolvedValue(perfil({ country: 'BR' }))
      mockApi.salvarPerfil.mockResolvedValue(
        perfil({ country: 'BR', documentHint: '789-09', documentCountry: 'BR' }),
      )
      await renderizar('BR')

      const doc = screen.getByLabelText('CPF')
      await userEvent.type(doc, '123.456.789-09')
      await userEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => expect(doc).toHaveValue(''))
    })
  })

  describe('quando a carga falha', () => {
    it('mostra o alerta com o botão de tentar de novo', async () => {
      mockApi.meuPerfil.mockRejectedValue(new Error('Network Error'))
      render(<DadosPessoais />)

      const alerta = await screen.findByRole('alert')
      expect(alerta).toHaveTextContent('Could not load your details.')
      expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
    })
  })
})
