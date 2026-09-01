/**
 * Camada 4 — `Paginacao`.
 *
 * O que este arquivo cobre, e por que estes casos:
 *
 * - **A mensagem de erro nasce JUNTO ao botão.** É o bug que o QA mediu em
 *   27/08: a falha do "Load more" era exibida no topo da página, e quem clicava
 *   no rodapé via a explicação nascer ~900px acima, fora da janela. O botão
 *   sumia em silêncio. Um teste de "a mensagem aparece" teria passado com o bug
 *   presente — o que prova o conserto é ela estar **dentro do mesmo `<nav>`**.
 * - **"Load more" só na última página.** Oferecê-lo na página 1 de 12
 *   convidaria a buscar mais antes de a pessoa olhar o que já tem.
 * - **"o nosso teto" e "acabou" são frases diferentes** (JOB-45). Dizer
 *   "that's all" com 49 mil vagas no filtro seria mentira, e a ação que cada
 *   caso pede é oposta.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Paginacao } from './Paginacao'

/** Os obrigatórios, para cada teste declarar só o que lhe interessa. */
function base() {
  return { atual: 1, paginas: 1, total: 10, onIr: vi.fn() }
}

describe('Paginacao', () => {
  describe('a navegação básica', () => {
    it('desabilita Previous na primeira página e Next na última', () => {
      render(<Paginacao {...base()} atual={1} paginas={3} />)

      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()
    })

    it('marca a página atual com aria-current — cor não basta', () => {
      // Quem não enxerga a cor precisa saber onde está. Sem `aria-current` a
      // página atual é indistinguível para o leitor de tela.
      render(<Paginacao {...base()} atual={2} paginas={3} />)

      const atual = screen.getByRole('button', { name: '2' })
      expect(atual).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('button', { name: '1' })).not.toHaveAttribute('aria-current')
    })

    it('clicar num número pede a página, e não a atual', async () => {
      const onIr = vi.fn()
      render(<Paginacao {...base()} atual={1} paginas={3} onIr={onIr} />)

      await userEvent.click(screen.getByRole('button', { name: '3' }))

      expect(onIr).toHaveBeenCalledWith(3)
    })

    it('a janela mostra no máximo 5 números', () => {
      // Com 40 páginas, listar todas viraria uma régua ilegível.
      render(<Paginacao {...base()} atual={20} paginas={40} />)

      const numeros = screen
        .getAllByRole('button')
        .map((b) => b.textContent ?? '')
        .filter((t) => /^\d+$/.test(t))

      expect(numeros).toHaveLength(5)
      expect(numeros).toContain('20')
    })
  })

  describe('o erro do "Load more" nasce junto ao botão (QA 27/08)', () => {
    it('a mensagem está DENTRO do mesmo nav dos controles', () => {
      // ⚠️ Este é o teste do bug. `getByRole('alert')` sozinho passaria mesmo
      // com a mensagem no topo da página — o que o conserto garante é a
      // PROXIMIDADE, e proximidade se mede por quem é o pai.
      render(
        <Paginacao
          {...base()}
          atual={2}
          paginas={2}
          temMais
          erro="Could not load more jobs."
          onMais={vi.fn()}
        />,
      )

      const nav = screen.getByRole('navigation', { name: 'Job list pages' })
      const alerta = within(nav).getByRole('alert')

      expect(alerta).toHaveTextContent('Could not load more jobs.')
    })

    it('o erro SUBSTITUI o botão — não se pede de novo o que acabou de falhar', () => {
      render(
        <Paginacao
          {...base()}
          atual={2}
          paginas={2}
          temMais
          erro="Could not load more jobs."
          onMais={vi.fn()}
        />,
      )

      // Deixar os dois lado a lado convidaria ao segundo clique imediato, que
      // repetiria a mesma falha.
      expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull()
    })

    it('sem erro, o botão volta', () => {
      // O contrapositivo: um componente que nunca mostrasse o botão passaria
      // no teste acima.
      render(<Paginacao {...base()} atual={2} paginas={2} temMais onMais={vi.fn()} />)

      expect(screen.getByRole('button', { name: 'Load more jobs' })).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  describe('o "Load more" só existe onde a pergunta nasce', () => {
    it('não aparece fora da última página', async () => {
      render(<Paginacao {...base()} atual={1} paginas={12} temMais onMais={vi.fn()} />)

      expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull()
    })

    it('aparece na última, e chama onMais ao clicar', async () => {
      const onMais = vi.fn()
      render(<Paginacao {...base()} atual={12} paginas={12} temMais onMais={onMais} />)

      await userEvent.click(screen.getByRole('button', { name: 'Load more jobs' }))

      expect(onMais).toHaveBeenCalledTimes(1)
    })

    it('sem onMais não aparece — a lista de salvas não busca nada', () => {
      render(<Paginacao {...base()} atual={1} paginas={1} temMais />)

      expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull()
    })

    it('enquanto carrega, o botão diz que está carregando e não aceita clique', async () => {
      const onMais = vi.fn()
      render(
        <Paginacao {...base()} atual={1} paginas={1} temMais carregandoMais onMais={onMais} />,
      )

      const botao = screen.getByRole('button', { name: 'Loading more jobs…' })
      expect(botao).toBeDisabled()

      // Clicar num botão desabilitado não pode disparar a segunda busca —
      // seria a mesma requisição cara duas vezes.
      await userEvent.click(botao)
      expect(onMais).not.toHaveBeenCalled()
    })
  })

  describe('"o nosso teto" e "acabou" são frases diferentes (JOB-45)', () => {
    it('teto manda refinar o filtro, e não diz que acabou', () => {
      render(<Paginacao {...base()} atual={1} paginas={1} total={200} motivo="teto" />)

      const texto = screen.getByText(/refine the filters/i)
      expect(texto).toHaveTextContent('Showing the first 200 matches')
      // Dizer "that's all" com 49 mil vagas no filtro seria mentira.
      expect(screen.queryByText(/That's all/)).toBeNull()
    })

    it('fim diz que acabou, com o total', () => {
      render(<Paginacao {...base()} atual={1} paginas={1} total={84} motivo="fim" />)

      expect(screen.getByText(/That's all 84 jobs/)).toBeTruthy()
      expect(screen.queryByText(/refine the filters/i)).toBeNull()
    })

    it('o motivo só aparece na última página', () => {
      render(<Paginacao {...base()} atual={1} paginas={5} total={84} motivo="fim" />)

      expect(screen.queryByText(/That's all/)).toBeNull()
    })

    it('a região do rodapé é aria-live: o texto muda sozinho quando a busca volta', () => {
      // "Load more jobs" vira "That's all 84 jobs" sem que a pessoa mexa em
      // nada, e quem usa leitor de tela precisa ouvir a mudança.
      const { container } = render(
        <Paginacao {...base()} atual={1} paginas={1} total={84} motivo="fim" />,
      )

      const viva = container.querySelector('[aria-live="polite"]')
      expect(viva).not.toBeNull()
      expect(viva).toHaveTextContent("That's all 84 jobs.")
    })
  })
})
