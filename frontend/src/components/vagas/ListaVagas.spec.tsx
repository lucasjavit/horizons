/**
 * Camada 4 — `ListaVagas` (QA-04).
 *
 * A tela principal do produto, 1.053 linhas, e a maior lacuna que o QA-03
 * deixou. O card nomeia **tres bugs ja medidos e ja corrigidos**; o que se
 * escreve aqui sao os testes que os teriam pegado — cada um visto falhar com a
 * correcao revertida (a tabela de mutacoes esta no card).
 *
 * 1. **Perda de escolha durante o upload do CV.** O `aoLerCv` acumula
 *    (`{...atual}`) em vez de substituir: quem marcou algo a mao antes de subir
 *    o curriculo nao perde.
 * 2. **O selo `CV` mentindo depois de "Clear filters".** `filtrosDoCv` conta os
 *    campos do modal — a fonte da verdade —, e nao um `origemCv` proprio.
 *    Limpar os filtros derruba o numero junto.
 * 3. **A contagem divergindo dos selos.** `quantosAtivos` e os chips do
 *    `PainelDeFiltros` leem o MESMO `avancadosDaBarra`.
 *
 * ## O que e dublado, e por que
 *
 * `api`, `busca-vagas` e o modal preguicoso. Este e teste de componente: falar
 * com o backend o tornaria lento e dependente de estado que outro teste criou
 * — as duas coisas que o card proibe.
 *
 * ⚠️ **A armadilha de corrida que o card documenta.** O `DadosPessoais.spec`
 * custou uma rodada de testes intermitentes por esperar so o elemento aparecer.
 * `ListaVagas` tem o mesmo formato: dois `useEffect` de carga (recursos +
 * historico, e as salvas) resolvem DEPOIS do primeiro render, e entre eles ha
 * renders com o estado vazio. Toda espera aqui e pelo **valor assentado** — o
 * chip que apareceu, o numero que mudou —, nunca pela presenca do no.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser, CvLido, Historico, OrdemAplicada, Vaga, VagaMarcada } from '../../types/api'

/**
 * O mock precisa existir ANTES do import do componente, porque ele captura
 * `api` no topo do modulo. `vi.mock` e icado pelo Vitest, entao a ordem no
 * arquivo nao engana — mas as funcoes vivem num objeto para os testes poderem
 * trocar o comportamento uma a uma.
 */
const mockApi = {
  recursosDeProduto: vi.fn(),
  listarHistorico: vi.fn(),
  listarSalvas: vi.fn(),
  lerCurriculo: vi.fn(),
  salvarVaga: vi.fn(),
  removerSalva: vi.fn(),
  marcarVaga: vi.fn(),
  desmarcarVaga: vi.fn(),
  verificarRemoto: vi.fn(),
}

vi.mock('../../lib/api', () => ({
  api: mockApi,
  // `ehSemSessao` decide se um erro de carga vira lista vazia ou silencio.
  // Nos testes nada e "sem sessao": o dublê devolve false e o componente segue
  // o caminho normal.
  ehSemSessao: () => false,
  errorMessage: (e: unknown) =>
    typeof e === 'object' && e && 'message' in e ? String((e as Error).message) : String(e),
}))

/**
 * A busca dublada, e o registro do que ela recebeu.
 *
 * `buscarVagas` e um **async generator**, e nao uma promessa: o dublê precisa
 * ser um tambem, senao o `for await` do componente lanca. `filtrosRecebidos`
 * guarda cada chamada — e diversos testes daqui provam o que VIAJA na busca,
 * que e onde os bugs de filtro se manifestam de verdade.
 */
const filtrosRecebidos: Record<string, unknown>[] = []
let vagasDaBusca: Vaga[] = []
/**
 * A ordem que o servidor diz ter aplicado, no `fim` (JOB-54).
 *
 * `undefined` = o `fim` nao traz o campo, como um servidor antigo. Os testes
 * de ordem trocam para simular a fonte que nao sabe ordenar.
 */
let ordemDoFim: OrdemAplicada | undefined

vi.mock('../../lib/busca-vagas', () => ({
  async *buscarVagas(filtros: Record<string, unknown>) {
    filtrosRecebidos.push(filtros)
    yield { tipo: 'inicio', total: vagasDaBusca.length }
    for (const vaga of vagasDaBusca) yield { tipo: 'vaga', vaga }
    yield { tipo: 'fim', sessao: null, temMais: false, totalNoFiltro: null, ordem: ordemDoFim }
  },
}))

/**
 * O modal de filtros e `lazy()`. Dublado por um formulario minimo que aplica
 * uma selecao fixa: o que se testa aqui e o que `ListaVagas` FAZ com o que o
 * modal devolve, e nao o modal — ele tem escopo proprio.
 */
vi.mock('./ModalFiltros', () => ({
  ModalFiltros: ({
    onAplicar,
    selecaoInicial,
  }: {
    onAplicar: (s: Record<string, string[]>) => void
    selecaoInicial: Record<string, string[]>
  }) => (
    <div role="dialog" aria-label="All filters">
      {/* Expoe a selecao que o modal RECEBEU: e assim que o teste do bug 1
          confere que o marcado a mao chegou la dentro. */}
      <span data-testid="modal-selecao">{JSON.stringify(selecaoInicial)}</span>
      <button type="button" onClick={() => onAplicar({ ...selecaoInicial, roles: ['backend'] })}>
        Apply backend
      </button>
      {/* Marca no MESMO eixo que o CV escreve, para o teste do bug 1 poder
          provar que os dois convivem em `technologies`. */}
      <button
        type="button"
        onClick={() => onAplicar({ ...selecaoInicial, technologies: ['Rust'] })}
      >
        Apply technologies
      </button>
      {/* TRES valores num eixo so. E o que distingue contar valores de contar
          eixos — a divergencia que o QA mediu ("3 filters" com oito selos na
          barra). Com um valor por eixo os dois calculos dao o mesmo numero, e a
          mutacao passaria despercebida. */}
      <button
        type="button"
        onClick={() => onAplicar({ ...selecaoInicial, technologies: ['Go', 'Rust', 'Kotlin'] })}
      >
        Apply three techs
      </button>
      {/* Uma busca salva ANTIGA aberta pelo modal: traz a janela de 20 dias
          que a tela nao oferece mais (JOB-54). O cast e o do proprio modal,
          que faz `b.filtros as SelecaoModal`. */}
      <button
        type="button"
        onClick={() =>
          onAplicar({ roles: ['backend'], posted_within_days: 20 } as unknown as Record<
            string,
            string[]
          >)
        }
      >
        Apply old saved search
      </button>
    </div>
  ),
}))

// O contexto de sessao e REAL, e nao dublado: o default dele (`null`) e
// exatamente o estado anonimo que o JOB-47 introduziu na tela, e dubla-lo
// faria o teste medir o duble em vez da regra.
import { SessaoContext } from '../../lib/sessao'

const { ListaVagas } = await import('./ListaVagas')

function vaga(over: Partial<Vaga> = {}): Vaga {
  return {
    id: 'v1',
    title: 'Backend Engineer',
    company: 'Acme',
    url: 'https://acme.example/jobs/1',
    local: 'Remote',
    fonte: 'acme.example',
    regime: null,
    skills: [],
    area: null,
    anosExp: null,
    benefits: [],
    degree: null,
    logoUrl: null,
    paisIso: null,
    salaryMin: null,
    salaryMax: null,
    currency: null,
    ...over,
  } as Vaga
}

function cvLido(over: Partial<CvLido['cvProfile']> = {}, cargos: string[] = []): CvLido {
  return {
    cvProfile: { stack: ['Go'], senioridade: 'senior', anos: 8, ...over },
    filtrosSugeridos: { job_titles: cargos },
  } as CvLido
}

/**
 * Uma entrada de "descartada".
 *
 * `VagaMarcada` tem quatro campos, e nao dois: `company` e `marcadaEm` sao
 * obrigatorios porque a vaga descartada SOME da lista e precisa ser desenhada
 * em outro lugar (o recorte "Dismissed") com dados proprios. Montar o objeto
 * pela metade e calar o tsc com um cast esconderia justamente isso.
 */
function marcada(url: string, title = 'Backend Engineer'): VagaMarcada {
  return { url, title, company: 'Acme', marcadaEm: '2026-09-01T00:00:00.000Z' }
}

const SEM_HISTORICO: Historico = { vistas: [], descartadas: [] }

/**
 * Renderiza e espera a tela estar **assentada**.
 *
 * ⚠️ Nao basta esperar a barra de busca: ela existe no primeiro render, antes
 * de `recursosDeProduto` resolver. Enquanto isso `leituraCvAtiva` e `undefined`
 * e a `CaixaUploadCV` devolve `null` — o botao "Upload CV" ainda nao existe.
 * Esperar por ele e esperar pelo VALOR que o efeito gravou.
 */
async function renderizar({ comCv = true }: { comCv?: boolean } = {}) {
  render(<ListaVagas />)
  if (comCv) {
    await screen.findByRole('button', { name: 'Upload CV' })
  } else {
    // Sem a caixa de CV, o que prova que os efeitos assentaram e a faixa de
    // filtros ja ter sido montada com o estado vazio.
    await screen.findByText(/No filters yet/i)
  }
}

/** A faixa de chips — `role="group"` com `aria-label="Active filters"`. */
function faixa() {
  return screen.getByRole('group', { name: 'Active filters' })
}

/** Os rotulos dos chips ativos, na ordem em que a faixa os desenha. */
function chips(): string[] {
  return within(faixa())
    .queryAllByRole('button')
    .map((b) => b.getAttribute('aria-label') ?? '')
    .filter((r) => r.startsWith('Remove '))
    .map((r) => r.replace(/^Remove (excluded )?/, ''))
}

/**
 * O numero do badge "All filters" — a contagem que o bug 3 fazia divergir.
 *
 * O botao anuncia "All filters" e traz o numero dentro; o teste le o texto e
 * extrai o digito, porque e exatamente isso que a pessoa ve.
 */
function contagemDeFiltros(): number {
  const botao = screen.getByRole('button', { name: /all filters/i })
  const m = botao.textContent?.match(/\d+/)
  return m ? Number(m[0]) : 0
}

/** Sobe um curriculo pelo caminho real: abrir o modal e escolher o arquivo. */
async function subirCv() {
  await userEvent.click(screen.getByRole('button', { name: 'Upload CV' }))
  const input = screen.getByLabelText('CV file')
  const arquivo = new File(['%PDF-1.4 cv'], 'curriculo.pdf', { type: 'application/pdf' })
  await userEvent.upload(input, arquivo)
}

describe('ListaVagas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    filtrosRecebidos.length = 0
    vagasDaBusca = []
    ordemDoFim = undefined
    mockApi.recursosDeProduto.mockResolvedValue({ leituraCvAtiva: true, historicoAtivo: false })
    mockApi.listarHistorico.mockResolvedValue(SEM_HISTORICO)
    mockApi.listarSalvas.mockResolvedValue([])
    mockApi.lerCurriculo.mockResolvedValue(cvLido())
    // JOB-55: desligado por padrao, para os testes dos outros cards verem a
    // tela de antes — sem selo e sem filtro.
    mockApi.verificarRemoto.mockResolvedValue({ estado: 'desligado', pais: null, vereditos: [] })
  })

  /**
   * BUG 1 — a escolha da pessoa some quando a leitura do curriculo volta.
   *
   * O `aoLerCv` faz `{...atual}` e o `juntar()` faz `new Set([...atual, ...])`.
   * Trocar por substituicao apaga o que a pessoa marcou a mao — e ela nao ve
   * acontecer, porque o upload leva segundos e ela ja saiu de perto.
   */
  describe('bug 1 · o upload do CV nao apaga o que a pessoa escolheu', () => {
    it('o filtro marcado a mao sobrevive a leitura do curriculo', async () => {
      await renderizar()

      // Marca algo a mao, pelo modal — o caminho que a pessoa usa.
      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply backend' }))
      await waitFor(() => expect(chips()).toContain('Backend'))

      await subirCv()

      // ⚠️ O ponto do teste: `Backend` continua la DEPOIS de o CV escrever.
      // Espera pelo valor assentado (o chip do CV chegou), e so entao afirma.
      await waitFor(() => expect(chips()).toContain('Go'))
      expect(chips()).toContain('Backend')
    })

    it('o que ja estava marcado no MESMO eixo do CV tambem sobrevive', async () => {
      // O caso mais apertado, e o que um teste de eixos diferentes nao pega: a
      // pessoa ja tinha uma tecnologia marcada em `technologies`, e o CV
      // escreve NESSE campo. `juntar()` faz `new Set([...atual, ...novos])`;
      // trocar por atribuicao apagaria so este eixo — silenciosamente.
      //
      // O valor a mao entra pelo modal (`Rust` em `technologies`), e nao por
      // "Replace CV": aquele botao chama `onSubstituir`, que APAGA o eixo de
      // proposito — e essa promessa tem teste proprio no bug 2.
      mockApi.lerCurriculo.mockResolvedValue(cvLido({ stack: ['Go'], senioridade: null }))
      await renderizar()

      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply technologies' }))
      await waitFor(() => expect(chips()).toContain('Rust'))

      await subirCv()

      // ⚠️ Os dois no mesmo eixo: o do CV entrou e o da pessoa continua.
      await waitFor(() => expect(chips()).toContain('Go'))
      expect(chips()).toContain('Rust')
    })

    it('o texto digitado na busca nao e apagado por um CV sem cargo', async () => {
      // `aoLerCv` so escreve no campo de texto quando o curriculo traz cargo
      // (`if (cargos[0])`). Sem a guarda, um CV sem cargo apagaria o que a
      // pessoa digitou — trocando o texto por `undefined`.
      mockApi.lerCurriculo.mockResolvedValue(cvLido({}, []))
      await renderizar()

      const campo = screen.getByRole('searchbox')
      await userEvent.type(campo, 'platform engineer')

      await subirCv()
      await waitFor(() => expect(chips()).toContain('Go'))

      expect(campo).toHaveValue('platform engineer')
    })

    it('erro na leitura do CV nao mexe em filtro nenhum', async () => {
      // A regra escrita no `catch` da `CaixaUploadCV`: o `onLeu` so e chamado
      // no caminho de sucesso. Um CV recusado que ainda assim mexesse nos
      // filtros seria o pior desfecho — busca ruim sem a pessoa ver por que.
      mockApi.lerCurriculo.mockRejectedValue(new Error('This file does not look like a CV.'))
      await renderizar()

      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply backend' }))
      await waitFor(() => expect(chips()).toContain('Backend'))

      await subirCv()

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Nothing was changed in your filters',
      )
      expect(chips()).toEqual(['Backend'])
    })
  })

  /**
   * BUG 2 — o selo `CV` continuava dizendo que os filtros vieram do curriculo
   * depois de eles terem sido limpos.
   *
   * A correcao foi `filtrosDoCv` contar `avancadosDaBarra` (a fonte da
   * verdade) em vez de um `origemCv` proprio, que `Clear all` nao alcancava.
   */
  describe('bug 2 · o selo do CV nao mente depois de "Clear all"', () => {
    it('a contagem do CV zera quando os filtros sao limpos', async () => {
      await renderizar()
      await subirCv()

      // O selo nomeia quantos filtros o CV marcou: Go + senior = 2.
      const linha = await screen.findByRole('status')
      await waitFor(() => expect(linha).toHaveTextContent('2 filters'))

      await userEvent.click(within(faixa()).getByRole('button', { name: /clear all/i }))

      // ⚠️ O bug: a linha seguia dizendo "we set 2 filters" com a faixa vazia.
      // Com zero marcado, a caixa troca de discurso ("nothing in it matched"),
      // que e o estado honesto — o pedido funcionou, o resultado nao serviu.
      await waitFor(() => expect(chips()).toEqual([]))
      expect(screen.queryByText(/we set/i)).toBeNull()
      expect(screen.getByText(/nothing in it matched/i)).toBeTruthy()
    })

    it('desmarcar um chip do CV derruba a contagem junto', async () => {
      // O mesmo bug em escala menor, e o que prova que os dois numeros leem a
      // mesma fonte: tirar UM valor tem de levar o selo de 2 para 1.
      await renderizar()
      await subirCv()

      const linha = await screen.findByRole('status')
      await waitFor(() => expect(linha).toHaveTextContent('2 filters'))

      await userEvent.click(within(faixa()).getByRole('button', { name: 'Remove Go' }))

      await waitFor(() => expect(linha).toHaveTextContent('1 filter'))
    })

    it('"Clear all" tambem tira os filtros do CV da BUSCA', async () => {
      // O bug original tinha um irmao pior que o selo: os valores lidos do CV
      // continuavam viajando em toda busca, invisiveis. O selo era o sintoma; a
      // busca com filtro fantasma era o estrago.
      await renderizar()
      await subirCv()
      await waitFor(() => expect(chips()).toContain('Go'))

      filtrosRecebidos.length = 0
      await userEvent.click(within(faixa()).getByRole('button', { name: /clear all/i }))

      await waitFor(() => expect(filtrosRecebidos.length).toBeGreaterThan(0))
      const ultimo = filtrosRecebidos[filtrosRecebidos.length - 1]
      // So a ordem padrao sobra (JOB-54): ela viaja em toda busca, e nao e
      // filtro — nenhum valor do CV, que e o que este teste guarda.
      expect(ultimo).toEqual({ sort: 'newest' })
    })

    it('"Replace CV" esquece o curriculo anterior', async () => {
      // Medido pelo QA em 25/08: subir um segundo CV dizia "we set 8 filters"
      // nomeando so o arquivo novo, com os valores do primeiro ainda marcados.
      // "Replace" promete substituir; acumular em silencio faz o botao mentir.
      await renderizar()
      await subirCv()
      await waitFor(() => expect(chips()).toContain('Go'))

      mockApi.lerCurriculo.mockResolvedValue(cvLido({ stack: ['Rust'], senioridade: 'junior' }))
      await userEvent.click(screen.getByRole('button', { name: /replace cv/i }))
      await userEvent.upload(
        screen.getByLabelText('CV file'),
        new File(['%PDF-1.4'], 'outro.pdf', { type: 'application/pdf' }),
      )

      await waitFor(() => expect(chips()).toContain('Rust'))
      // O `onSubstituir` apaga `technologies` e `seniorities` ANTES de o novo
      // CV escrever: `Go` nao pode ter sobrevivido.
      expect(chips()).not.toContain('Go')
    })
  })

  /**
   * BUG 3 — o numero de filtros ativos nao batia com os selos desenhados.
   *
   * `quantosAtivos` soma os valores de `avancadosDaBarra` mais o texto da
   * busca; os chips saem do mesmo objeto mais o mesmo texto. Um contador com
   * fonte propria diverge na primeira mudanca — foi o que aconteceu quando
   * `work_modes`/`regions` eram estado separado.
   */
  describe('bug 3 · a contagem bate com os selos desenhados', () => {
    it('sem filtro, zero e nenhum chip', async () => {
      await renderizar()

      expect(chips()).toEqual([])
      expect(contagemDeFiltros()).toBe(0)
      expect(screen.getByText(/No filters yet/i)).toBeTruthy()
    })

    it('o texto da busca conta como UM filtro e desenha UM chip', async () => {
      // O texto e o caso que mais escapa: ele nao vive em `avancadosDaBarra`, e
      // um contador que so somasse o objeto diria 0 com um chip na tela.
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'golang')

      await waitFor(() => expect(chips()).toEqual(['golang']))
      expect(contagemDeFiltros()).toBe(1)
    })

    it('o numero acompanha os selos a cada valor marcado', async () => {
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'golang')
      await waitFor(() => expect(contagemDeFiltros()).toBe(1))

      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply backend' }))

      // ⚠️ A invariante: o numero e a quantidade de chips sao a mesma coisa
      // vista de dois lugares. Afirmar os dois juntos e o que pega a divergencia.
      await waitFor(() => expect(chips()).toEqual(['golang', 'Backend']))
      expect(contagemDeFiltros()).toBe(chips().length)
    })

    it('conta VALORES, e nao eixos — tres tecnologias sao tres filtros', async () => {
      // ⚠️ A forma exata do bug medido: contar eixos daria "1 filter" com tres
      // selos na faixa, ou "3 filters" onde a barra mostra oito. Um valor por
      // eixo nao distingue os dois calculos — este teste precisa de um eixo
      // com varios valores para ter poder de deteccao.
      await renderizar()

      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply three techs' }))

      await waitFor(() => expect(chips()).toEqual(['Go', 'Rust', 'Kotlin']))
      expect(contagemDeFiltros()).toBe(3)
    })

    it('valores em eixos diferentes somam todos', async () => {
      // O complemento: tres tecnologias + um cargo + o texto = cinco. Um
      // contador que somasse so o maior eixo, ou so o primeiro, erraria aqui.
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'golang')
      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply three techs' }))
      await waitFor(() => expect(chips()).toContain('Kotlin'))

      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply backend' }))

      await waitFor(() => expect(chips()).toContain('Backend'))
      expect(contagemDeFiltros()).toBe(chips().length)
      expect(contagemDeFiltros()).toBe(5)
    })

    it('a contagem e a faixa concordam depois do CV', async () => {
      await renderizar()
      await subirCv()

      await waitFor(() => expect(chips()).toContain('Go'))
      expect(contagemDeFiltros()).toBe(chips().length)
    })

    it('remover um chip derruba a contagem junto', async () => {
      await renderizar()
      await userEvent.type(screen.getByRole('searchbox'), 'golang')
      await waitFor(() => expect(contagemDeFiltros()).toBe(1))

      await userEvent.click(within(faixa()).getByRole('button', { name: 'Remove golang' }))

      await waitFor(() => expect(chips()).toEqual([]))
      expect(contagemDeFiltros()).toBe(0)
    })

    it('espaco em branco nao vira filtro', async () => {
      // `textoDaBusca.trim()` nos dois lados. Sem o trim num deles, digitar um
      // espaco daria "1 filtro" sem chip nenhum — a divergencia do bug 3 no seu
      // caso mais barato de produzir.
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), '   ')

      expect(chips()).toEqual([])
      expect(contagemDeFiltros()).toBe(0)
    })
  })

  /**
   * O que a busca recebe. Os bugs de filtro se manifestam aqui — um valor que
   * viaja invisivel e pior que um selo errado.
   */
  describe('o que viaja na busca', () => {
    it('o texto do topo vai como job_titles', async () => {
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'golang{Enter}')

      await waitFor(() => expect(filtrosRecebidos.length).toBeGreaterThan(0))
      // `sort: 'newest'` vai junto desde o JOB-54 — o padrao e explicito.
      expect(filtrosRecebidos[filtrosRecebidos.length - 1]).toEqual({
        job_titles: ['golang'],
        sort: 'newest',
      })
    })

    it('o CV manda a senioridade TRADUZIDA para o vocabulario da faceta', async () => {
      // Medido em 26/08: `pleno` nao existe na faceta e devolve zero, o que
      // zera as 25 facetas e deixa o modal em branco. A traducao e `middle`.
      mockApi.lerCurriculo.mockResolvedValue(cvLido({ stack: [], senioridade: 'pleno' }))
      await renderizar()
      await subirCv()

      // O chip prova a traducao: `pleno` nao tem rotulo na faceta e cairia no
      // fallback como "Pleno"; `middle` tem, e sai como "Mid-level".
      await waitFor(() => expect(chips()).toContain('Mid-level'))

      // E o valor TRADUZIDO e o que viaja na busca — o chip poderia estar
      // certo com o filtro errado indo para o servidor.
      await userEvent.click(screen.getByRole('searchbox'))
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(filtrosRecebidos.length).toBeGreaterThan(0))
      expect(filtrosRecebidos[filtrosRecebidos.length - 1]).toMatchObject({
        seniorities: ['middle'],
      })
    })

    it('o cargo do CV vai para o campo de texto, e nao para a faceta roles', async () => {
      // `roles` e vocabulario fechado e exige o slug: `roles=["Backend
      // Engineer"]` devolvia 0 e zerava o modal. `job_titles` e full-text.
      // E o campo de texto e onde a pessoa VE o cargo e consegue apaga-lo.
      mockApi.lerCurriculo.mockResolvedValue(cvLido({ stack: [] }, ['Backend Engineer']))
      await renderizar()
      await subirCv()

      await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Backend Engineer'))
    })

    it('o CV corta a stack em 20 — o ArrayMaxSize do DTO morde com 400', async () => {
      // Medido em 26/08: um curriculo com 21 tecnologias devolvia 400 e a tela
      // mostrava "Something went wrong with this filter combination". Curriculo
      // com 25 stacks e comum.
      const stack = Array.from({ length: 25 }, (_, i) => `tech${i}`)
      mockApi.lerCurriculo.mockResolvedValue(cvLido({ stack, senioridade: null }))
      await renderizar()
      await subirCv()

      await waitFor(() => expect(chips().length).toBe(20))
    })
  })

  /** A lista, o streaming e a contagem do rodape. */
  describe('a lista e o resultado', () => {
    it('as vagas entram e a contagem aparece', async () => {
      vagasDaBusca = [
        vaga({ id: 'a', title: 'Go Engineer', url: 'https://x.example/a' }),
        vaga({ id: 'b', title: 'Rust Engineer', url: 'https://x.example/b' }),
      ]
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')

      expect(await screen.findByText('2 jobs found')).toBeTruthy()
      expect(screen.getByText('Go Engineer')).toBeTruthy()
      expect(screen.getByText('Rust Engineer')).toBeTruthy()
    })

    it('busca sem resultado explica o que fazer, em vez de ficar em branco', async () => {
      vagasDaBusca = []
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'cobol{Enter}')

      expect(await screen.findByText(/No jobs matched/i)).toBeTruthy()
    })

    it('nao afirma "0 jobs found" antes de alguem ter buscado', async () => {
      // A linha so aparece depois de buscar: afirmar um resultado que nao
      // houve faz a tela recem-aberta parecer uma busca fracassada.
      await renderizar()

      expect(screen.queryByText(/jobs found/i)).toBeNull()
      expect(screen.queryByText(/No jobs matched/i)).toBeNull()
    })

    it('uma vaga so diz "1 job found", no singular', async () => {
      vagasDaBusca = [vaga()]
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')

      expect(await screen.findByText('1 job found')).toBeTruthy()
    })
  })

  /**
   * O historico (JOB-26). So existe quando o recurso esta ligado — e `null` e
   * exatamente o estado que esconde o selo e o `×`.
   */
  describe('o historico', () => {
    beforeEach(() => {
      mockApi.recursosDeProduto.mockResolvedValue({ leituraCvAtiva: true, historicoAtivo: true })
    })

    it('com o recurso desligado, nem pede a lista', async () => {
      // O interruptor e consultado ANTES de buscar o historico. Pedir e
      // descartar gastaria uma chamada por visita para nada.
      mockApi.recursosDeProduto.mockResolvedValue({
        leituraCvAtiva: true,
        historicoAtivo: false,
      })
      vagasDaBusca = [vaga()]
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      await screen.findByText('1 job found')

      expect(mockApi.listarHistorico).not.toHaveBeenCalled()
      expect(screen.queryByRole('radiogroup', { name: /filter by history/i })).toBeNull()
    })

    it('os selos contam All, New e Dismissed sobre a MESMA lista', async () => {
      // Medido pelo QA em 24/08: com 30 vagas e 3 descartadas, os selos diziam
      // "All (27)" e o rodape "30 jobs" — dois numeros para a mesma lista.
      vagasDaBusca = [
        vaga({ id: 'a', url: 'https://x.example/a' }),
        vaga({ id: 'b', url: 'https://x.example/b' }),
        vaga({ id: 'c', url: 'https://x.example/c' }),
      ]
      mockApi.listarHistorico.mockResolvedValue({
        vistas: ['https://x.example/a'],
        descartadas: [marcada('https://x.example/c')],
      } satisfies Historico)
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')

      const grupo = await screen.findByRole('radiogroup', { name: /filter by history/i })
      // 3 vagas: a (vista), b (nova), c (descartada).
      await waitFor(() => {
        expect(within(grupo).getByRole('radio', { name: 'All (2)' })).toBeTruthy()
      })
      expect(within(grupo).getByRole('radio', { name: 'New (1)' })).toBeTruthy()
      expect(within(grupo).getByRole('radio', { name: 'Dismissed (1)' })).toBeTruthy()
    })

    it('a descartada some de "All", e nao so de "New"', async () => {
      // "Some da lista e nao volta" e o criterio do card: uma vaga descartada
      // que continua na aba principal nao foi descartada, foi anotada.
      vagasDaBusca = [
        vaga({ id: 'a', title: 'Fica', url: 'https://x.example/a' }),
        vaga({ id: 'c', title: 'Descartada', url: 'https://x.example/c' }),
      ]
      mockApi.listarHistorico.mockResolvedValue({
        vistas: [],
        descartadas: [marcada('https://x.example/c', 'Descartada')],
      } satisfies Historico)
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      await screen.findByRole('radiogroup', { name: /filter by history/i })

      await waitFor(() => expect(screen.getByText('Fica')).toBeTruthy())
      expect(screen.queryByText('Descartada')).toBeNull()
    })

    it('o recorte "Dismissed" mostra o que foi escondido, com o caminho de volta', async () => {
      // O descarte nao pode ser irreversivel na pratica: quem so percebeu o
      // clique errado depois acha a vaga aqui.
      vagasDaBusca = [vaga({ id: 'c', title: 'Descartada', url: 'https://x.example/c' })]
      mockApi.listarHistorico.mockResolvedValue({
        vistas: [],
        descartadas: [marcada('https://x.example/c', 'Descartada')],
      } satisfies Historico)
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      const grupo = await screen.findByRole('radiogroup', { name: /filter by history/i })

      await userEvent.click(within(grupo).getByRole('radio', { name: 'Dismissed (1)' }))

      expect(await screen.findByRole('button', { name: /Restore/ })).toBeTruthy()
    })
  })

  /** Falhas de rede: a tela nao pode perder o que a pessoa fez. */
  describe('quando algo falha', () => {
    it('falha ao carregar as salvas nao derruba a busca', async () => {
      // Falha silenciosa de proposito: uma lista de vagas nao deve mostrar erro
      // porque as salvas nao carregaram.
      mockApi.listarSalvas.mockRejectedValue(new Error('Network Error'))
      vagasDaBusca = [vaga()]
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')

      expect(await screen.findByText('1 job found')).toBeTruthy()
    })

    it('falha ao carregar o historico nao derruba a busca', async () => {
      mockApi.recursosDeProduto.mockResolvedValue({ leituraCvAtiva: true, historicoAtivo: true })
      mockApi.listarHistorico.mockRejectedValue(new Error('Network Error'))
      vagasDaBusca = [vaga()]
      await renderizar()

      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')

      expect(await screen.findByText('1 job found')).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('a caixa de CV nao aparece com a leitura desligada no servidor', async () => {
      // Esconder a caixa e cortesia, nao protecao — o servidor confere o mesmo
      // interruptor. Mas oferecer um upload que o servidor recusa e pior que
      // nao oferecer.
      mockApi.recursosDeProduto.mockResolvedValue({
        leituraCvAtiva: false,
        historicoAtivo: false,
      })
      await renderizar({ comCv: false })

      expect(screen.queryByRole('button', { name: 'Upload CV' })).toBeNull()
    })
  })

  /**
   * JOB-47 — a lista atende quem nao entrou.
   *
   * O `SessaoContext` tem `null` como default (ver `lib/sessao.ts`), entao
   * renderizar sem Provider JA e o caso anonimo — e e o caso que todos os
   * outros testes deste arquivo exercitam sem dizer. Aqui ele e nomeado, e o
   * caso COM sessao entra por Provider.
   */
  describe('JOB-47 — o convite do anonimo no fim da lista', () => {
    beforeEach(() => {
      mockApi.recursosDeProduto.mockResolvedValue({
        leituraCvAtiva: false,
        historicoAtivo: false,
      })
    })

    it('anonimo com vaga na tela ve o convite, e ele explica o que se ganha', async () => {
      vagasDaBusca = [vaga()]
      await renderizar({ comCv: false })
      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      expect(await screen.findByText('1 job found')).toBeTruthy()

      // O titulo diz o ESTADO ("vagas de duas semanas atras"), e o corpo diz o
      // ganho. "Unauthorized" seria o oposto do que o card pede.
      const convite = await screen.findByRole('region', {
        name: /Seeing jobs from two weeks ago/i,
      })
      expect(convite).toBeTruthy()
      expect(within(convite).getByText(/14 days ago or more/i)).toBeTruthy()
      expect(within(convite).getByText(/newest postings/i)).toBeTruthy()
    })

    it('com sessao, o convite NAO aparece', async () => {
      // O contrapositivo: sem ele, um convite que aparecesse para todo mundo
      // passaria no teste de cima. Quem entrou nao pode ser convidado a entrar.
      vagasDaBusca = [vaga()]
      render(
        <SessaoContext.Provider
          value={{
            id: 'u1',
            email: 'quem@entrou.com',
            name: 'Quem Entrou',
            avatarUrl: null,
            role: 'COMMON_USER',
          }}
        >
          <ListaVagas />
        </SessaoContext.Provider>,
      )
      await screen.findByText(/No filters yet/i)
      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      expect(await screen.findByText('1 job found')).toBeTruthy()

      expect(
        screen.queryByRole('region', { name: /Seeing jobs from two weeks ago/i }),
      ).toBeNull()
    })

    it('busca sem resultado nenhum nao mostra o convite — nao e consolo', async () => {
      // Num resultado vazio ele viraria explicacao para quem nao achou nada, e
      // a tela ja tem a frase certa ("No jobs matched") para esse caso.
      //
      // ⚠️ Este teste passa por DOIS motivos somados: o convite esta dentro do
      // bloco `vagas.length > 0`. Quem prova o `filtradas.length > 0` e o
      // teste seguinte — descobri isso por mutacao, e foi ele que nasceu da
      // mutacao sobrevivente.
      vagasDaBusca = []
      await renderizar({ comCv: false })
      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      expect(await screen.findByText(/No jobs matched/i)).toBeTruthy()

      expect(
        screen.queryByRole('region', { name: /Seeing jobs from two weeks ago/i }),
      ).toBeNull()
    })

    /**
     * O caso que o `filtradas.length > 0` existe para cobrir.
     *
     * A busca ACHOU vagas, mas o recorte ativo esconde todas: a tela mostra
     * "No new jobs here" e nenhuma linha. O convite ali embaixo ficaria solto
     * sob uma lista vazia, dizendo "estas vagas sao de duas semanas atras"
     * sobre nenhuma vaga.
     *
     * Nasceu de uma mutacao SOBREVIVENTE: trocar a condicao por `!usuario`
     * sozinho nao quebrava teste nenhum, porque o unico caso de lista vazia
     * que eu testava ja era impossivel pelo bloco de fora.
     */
    it('lista esvaziada pelo recorte tambem nao mostra o convite', async () => {
      // Historico ligado, e a unica vaga da busca ja foi vista: no recorte
      // "New" ela desaparece, e `filtradas` fica vazia com `vagas` cheia.
      mockApi.recursosDeProduto.mockResolvedValue({
        leituraCvAtiva: false,
        historicoAtivo: true,
      })
      mockApi.listarHistorico.mockResolvedValue({
        vistas: ['https://acme.example/jobs/1'],
        descartadas: [],
      })
      vagasDaBusca = [vaga()]

      await renderizar({ comCv: false })
      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      expect(await screen.findByText('1 job found')).toBeTruthy()
      // Com a vaga na tela, o convite esta la — o estado de partida.
      expect(
        await screen.findByRole('region', { name: /Seeing jobs from two weeks ago/i }),
      ).toBeTruthy()

      // Troca para "New": a unica vaga e conhecida, entao a lista esvazia.
      // `radio` e nao `button`: os tres recortes sao um `radiogroup`, porque
      // sao opcoes exclusivas sobre a mesma lista.
      await userEvent.click(screen.getByRole('radio', { name: /^New/ }))
      expect(await screen.findByText(/No new jobs here/i)).toBeTruthy()

      expect(
        screen.queryByRole('region', { name: /Seeing jobs from two weeks ago/i }),
      ).toBeNull()
    })

    it('e o convite vem DEPOIS da lista, nao antes', async () => {
      // "No fim da lista, nao num banner permanente" e o criterio 4 do card. A
      // ordem no DOM e o que se pode medir disso: um banner no topo apareceria
      // antes da lista.
      vagasDaBusca = [vaga()]
      await renderizar({ comCv: false })
      await userEvent.type(screen.getByRole('searchbox'), 'engineer{Enter}')
      expect(await screen.findByText('1 job found')).toBeTruthy()

      // A ancora e o LINK DA VAGA, e nao o `<ul>`: a tela tem varias listas
      // (a faixa de chips, os recortes), e `getByRole('list')` acha mais de
      // uma. O link do anuncio e inequivocamente o conteudo da lista.
      const vagaNaTela = screen.getByRole('link', { name: /Backend Engineer/i })
      const convite = screen.getByRole('region', {
        name: /Seeing jobs from two weeks ago/i,
      })
      // `DOCUMENT_POSITION_FOLLOWING` = o convite vem depois da vaga.
      expect(
        vagaNaTela.compareDocumentPosition(convite) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })

  /**
   * JOB-54 — `Posted` e `Sort`.
   *
   * O que se prova e o que VIAJA: a ordem e a janela so existem para o
   * servidor, entao um seletor que muda na tela e nao muda o pedido e o
   * "filtro que nao filtra" deste card. Toda espera e pelo pedido que chegou
   * (`filtrosRecebidos`), nunca pelo no do seletor — ele existe desde o
   * primeiro render.
   */
  describe('JOB-54 — Posted e Sort', () => {
    const QUEM_ENTROU: AuthUser = {
      id: 'u1',
      email: 'quem@entrou.com',
      name: 'Quem Entrou',
      avatarUrl: null,
      role: 'COMMON_USER',
    }

    /** Com sessao: sem ela o `Sort` fica desabilitado (regra do JOB-47). */
    async function renderizarLogado() {
      render(
        <SessaoContext.Provider value={QUEM_ENTROU}>
          <ListaVagas />
        </SessaoContext.Provider>,
      )
      await screen.findByRole('button', { name: 'Upload CV' })
    }

    beforeEach(() => {
      // O jsdom nao implementa `scrollTo`, e trocar de pagina o chama.
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    })

    const ultimo = () => filtrosRecebidos[filtrosRecebidos.length - 1]
    const sort = () => screen.getByLabelText('Sort') as HTMLSelectElement
    const posted = () => screen.getByLabelText('Posted') as HTMLSelectElement
    const opcoes = (s: HTMLSelectElement) => [...s.options].map((o) => o.textContent)

    it('os dois controles tem label, e oferecem as opcoes do card', async () => {
      await renderizarLogado()

      expect(opcoes(sort())).toEqual(['Newest', 'Relevance', 'Most viewed', 'Best match'])
      expect(opcoes(posted())).toEqual([
        'Any time',
        'Today',
        'Last 3 days',
        'Last 7 days',
        'Last 14 days',
        'Last 30 days',
      ])
      // Os padroes: mais recente primeiro, sem janela.
      expect(sort().value).toBe('newest')
      expect(posted().value).toBe('')
    })

    it('o padrao Newest viaja no pedido, sem janela', async () => {
      await renderizarLogado()
      await userEvent.type(screen.getByRole('searchbox'), 'backend{Enter}')

      await waitFor(() => expect(filtrosRecebidos).toHaveLength(1))
      expect(ultimo()).toEqual({ job_titles: ['backend'], sort: 'newest' })
    })

    it.each([
      ['Relevance', 'relevance'],
      ['Most viewed', 'views'],
    ])('trocar o Sort para %s refaz a busca com sort=%s', async (rotulo, valor) => {
      await renderizarLogado()
      await userEvent.type(screen.getByRole('searchbox'), 'backend{Enter}')
      await waitFor(() => expect(filtrosRecebidos).toHaveLength(1))

      await userEvent.selectOptions(sort(), rotulo)

      // Uma busca NOVA, com o valor novo e o resto do pedido intacto.
      await waitFor(() => expect(filtrosRecebidos).toHaveLength(2))
      expect(ultimo()).toEqual({ job_titles: ['backend'], sort: valor })
    })

    it.each([
      ['Today', 1],
      ['Last 3 days', 3],
      ['Last 7 days', 7],
      ['Last 14 days', 14],
      ['Last 30 days', 30],
    ])('Posted = %s refaz a busca com posted_within_days=%i', async (rotulo, dias) => {
      await renderizarLogado()

      await userEvent.selectOptions(posted(), rotulo)

      await waitFor(() => expect(filtrosRecebidos).toHaveLength(1))
      expect(ultimo()).toEqual({ sort: 'newest', posted_within_days: dias })
    })

    it('Posted e escolha UNICA: a segunda substitui a primeira, e Any time tira o campo', async () => {
      await renderizarLogado()

      await userEvent.selectOptions(posted(), 'Last 7 days')
      await waitFor(() => expect(filtrosRecebidos).toHaveLength(1))
      await userEvent.selectOptions(posted(), 'Today')
      await waitFor(() => expect(filtrosRecebidos).toHaveLength(2))

      // Um numero, e o ULTIMO escolhido — o filtro antigo mandava o maior.
      expect(posted().multiple).toBe(false)
      expect(ultimo().posted_within_days).toBe(1)

      await userEvent.selectOptions(posted(), 'Any time')
      await waitFor(() => expect(filtrosRecebidos).toHaveLength(3))
      expect(ultimo()).toEqual({ sort: 'newest' })
    })

    it('a ordem e a janela continuam no pedido quando OUTRO gesto busca', async () => {
      // O risco que a ref cobre: seis gatilhos de busca, e um que esquecesse a
      // ordem devolveria a lista por relevancia com o seletor em Most viewed.
      await renderizarLogado()
      await userEvent.selectOptions(sort(), 'Most viewed')
      await userEvent.selectOptions(posted(), 'Last 3 days')
      await waitFor(() => expect(filtrosRecebidos).toHaveLength(2))

      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply backend' }))

      await waitFor(() => expect(filtrosRecebidos).toHaveLength(3))
      expect(ultimo()).toEqual({ roles: ['backend'], sort: 'views', posted_within_days: 3 })
    })

    it('trocar o Sort volta para a pagina 1', async () => {
      // 30 vagas = duas paginas de 25.
      vagasDaBusca = Array.from({ length: 30 }, (_, i) =>
        vaga({ id: `v${i}`, title: `Vaga ${i}`, url: `https://acme.example/jobs/${i}` }),
      )
      await renderizarLogado()
      await userEvent.type(screen.getByRole('searchbox'), 'backend{Enter}')
      await screen.findByText('30 jobs found')

      const paginas = () => screen.getByRole('navigation', { name: 'Job list pages' })
      await userEvent.click(within(paginas()).getByRole('button', { name: /2/ }))
      await waitFor(() =>
        expect(within(paginas()).getByRole('button', { current: 'page' }).textContent).toBe('2'),
      )

      await userEvent.selectOptions(sort(), 'Most viewed')

      await waitFor(() => expect(filtrosRecebidos).toHaveLength(2))
      await waitFor(() =>
        expect(within(paginas()).getByRole('button', { current: 'page' }).textContent).toBe('1'),
      )
    })

    it('trocar o Posted tambem volta para a pagina 1', async () => {
      vagasDaBusca = Array.from({ length: 30 }, (_, i) =>
        vaga({ id: `v${i}`, title: `Vaga ${i}`, url: `https://acme.example/jobs/${i}` }),
      )
      await renderizarLogado()
      await userEvent.type(screen.getByRole('searchbox'), 'backend{Enter}')
      await screen.findByText('30 jobs found')

      const paginas = () => screen.getByRole('navigation', { name: 'Job list pages' })
      await userEvent.click(within(paginas()).getByRole('button', { name: /2/ }))
      await waitFor(() =>
        expect(within(paginas()).getByRole('button', { current: 'page' }).textContent).toBe('2'),
      )

      await userEvent.selectOptions(posted(), 'Last 3 days')

      await waitFor(() => expect(filtrosRecebidos).toHaveLength(2))
      await waitFor(() =>
        expect(within(paginas()).getByRole('button', { current: 'page' }).textContent).toBe('1'),
      )
    })

    it('a janela vira chip, e "Clear all" a tira — mas NAO desfaz o Sort', async () => {
      await renderizarLogado()
      await userEvent.selectOptions(sort(), 'Relevance')
      await userEvent.selectOptions(posted(), 'Last 7 days')
      await waitFor(() => expect(chips()).toEqual(['Posted: Last 7 days']))

      await userEvent.click(within(faixa()).getByRole('button', { name: 'Clear all' }))

      await waitFor(() => expect(posted().value).toBe(''))
      expect(ultimo()).toEqual({ sort: 'relevance' })
      expect(sort().value).toBe('relevance')
    })

    describe('Best match', () => {
      const melhor = () =>
        [...sort().options].find((o) => o.textContent === 'Best match') as HTMLOptionElement

      it('sem tecnologia marcada fica desabilitado, e a tela diz como habilitar', async () => {
        await renderizarLogado()

        expect(melhor().disabled).toBe(true)
        expect(screen.getByText(/Best match needs skills/i)).toBeTruthy()
      })

      it('com tecnologia habilita, viaja como sort=match, e avisa que ordena so o carregado', async () => {
        await renderizarLogado()
        await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
        await userEvent.click(await screen.findByRole('button', { name: 'Apply technologies' }))
        await waitFor(() => expect(melhor().disabled).toBe(false))

        await userEvent.selectOptions(sort(), 'Best match')

        await waitFor(() => expect(ultimo().sort).toBe('match'))
        expect(ultimo().technologies).toEqual(['Rust'])
        expect(screen.getByText(/jobs already loaded/i)).toBeTruthy()
      })

      it('tirar a ultima tecnologia devolve o Sort ao padrao, na tela e no pedido', async () => {
        await renderizarLogado()
        await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
        await userEvent.click(await screen.findByRole('button', { name: 'Apply technologies' }))
        await waitFor(() => expect(melhor().disabled).toBe(false))
        await userEvent.selectOptions(sort(), 'Best match')
        await waitFor(() => expect(ultimo().sort).toBe('match'))

        await userEvent.click(within(faixa()).getByRole('button', { name: 'Remove Rust' }))

        await waitFor(() => expect(ultimo()).toEqual({ sort: 'newest' }))
        await waitFor(() => expect(sort().value).toBe('newest'))
      })
    })

    describe('quando a fonte que respondeu nao honra a ordem', () => {
      it('avisa que a lista veio em outra ordem, nomeando as duas', async () => {
        vagasDaBusca = [vaga()]
        await renderizarLogado()
        await userEvent.type(screen.getByRole('searchbox'), 'backend{Enter}')
        await screen.findByText('1 job found')

        // O ATS responde: ele so ordena por data.
        ordemDoFim = 'newest'
        await userEvent.selectOptions(sort(), 'Most viewed')

        expect(
          await screen.findByText(/cannot sort by "Most viewed"\. Showing newest first/i),
        ).toBeTruthy()
      })

      it('nao avisa quando a ordem aplicada e a pedida', async () => {
        vagasDaBusca = [vaga()]
        ordemDoFim = 'newest'
        await renderizarLogado()
        await userEvent.type(screen.getByRole('searchbox'), 'backend{Enter}')
        await screen.findByText('1 job found')

        expect(screen.queryByText(/cannot sort/i)).toBeNull()
      })
    })

    it('busca salva antiga com 20 dias continua valendo, e aparece no Posted', async () => {
      await renderizarLogado()
      await userEvent.click(screen.getByRole('button', { name: /all filters/i }))
      await userEvent.click(await screen.findByRole('button', { name: 'Apply old saved search' }))

      await waitFor(() =>
        expect(ultimo()).toEqual({ roles: ['backend'], sort: 'newest', posted_within_days: 20 }),
      )
      // O seletor mostra o que esta valendo, em vez de fingir Any time.
      expect(posted().value).toBe('20')
      expect(posted().selectedOptions[0].textContent).toBe('Last 20 days')
    })

    describe('sem sessao (JOB-47)', () => {
      it('o Sort fica desabilitado e a tela diz por que', async () => {
        await renderizar()

        expect(sort().disabled).toBe(true)
        expect(screen.getByText(/Sign in to sort results/i)).toBeTruthy()
      })

      it('as janelas que so dariam lista vazia ficam desabilitadas; 30 dias nao', async () => {
        await renderizar()

        const desabilitadas = [...posted().options].filter((o) => o.disabled).map((o) => o.textContent)
        expect(desabilitadas).toEqual(['Today', 'Last 3 days', 'Last 7 days', 'Last 14 days'])
      })
    })
  })

  /**
   * JOB-55 — a IA verifica se a vaga e remota para o pais da pessoa.
   *
   * A verificacao e um acrescimo sobre a lista: o que se mede e que ela nunca
   * a atrasa nem a quebra, e que o veredito chega como TEXTO.
   */
  describe('JOB-55 — remoto do meu pais', () => {
    const QUEM_ENTROU: AuthUser = {
      id: 'u1',
      email: 'quem@entrou.com',
      name: 'Quem Entrou',
      avatarUrl: null,
      role: 'COMMON_USER',
    }
    const TRES = [
      vaga({ id: 'a', title: 'Aceita Brasil', url: 'https://x.example/a' }),
      vaga({ id: 'b', title: 'So Estados Unidos', url: 'https://x.example/b' }),
      vaga({ id: 'c', title: 'Nao Diz Nada', url: 'https://x.example/c' }),
      vaga({ id: 'd', title: 'IA Fora Do Ar', url: 'https://x.example/d' }),
    ]
    const RESPOSTA = {
      estado: 'ok',
      pais: 'Brazil',
      vereditos: [
        { id: 'a', veredito: 'sim', trecho: 'Open to candidates anywhere in Latin America.' },
        { id: 'b', veredito: 'nao', trecho: 'Remote (US only).' },
        { id: 'c', veredito: 'nao_diz', trecho: null },
        // 'd' nao vem: o servidor nao conseguiu ler.
      ],
    }

    async function buscarLogado(logado = true) {
      vagasDaBusca = TRES
      render(
        <SessaoContext.Provider value={logado ? QUEM_ENTROU : null}>
          <ListaVagas />
        </SessaoContext.Provider>,
      )
      await screen.findByRole('button', { name: 'Upload CV' })
      await userEvent.click(screen.getByRole('button', { name: 'Search' }))
      await screen.findByRole('link', { name: 'Aceita Brasil' })
    }

    it('a lista aparece ANTES do veredito, com "Checking…" em cada vaga', async () => {
      let responder: (r: unknown) => void = () => {}
      mockApi.verificarRemoto.mockReturnValue(new Promise((ok) => (responder = ok)))

      await buscarLogado()

      // As quatro vagas estao na tela e a resposta ainda nao chegou.
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
      await waitFor(() => expect(screen.getAllByText(/^Checking/)).toHaveLength(4))
      // So os ids vao — a descricao e lida pelo servidor.
      expect(mockApi.verificarRemoto.mock.calls[0][0]).toEqual(['a', 'b', 'c', 'd'])

      responder(RESPOSTA)
      expect(await screen.findByText('Remote from Brazil')).toBeInTheDocument()
      expect(screen.queryByText(/^Checking/)).not.toBeInTheDocument()
    })

    it('os tres vereditos sao texto, e o trecho do anuncio fica a um clique', async () => {
      mockApi.verificarRemoto.mockResolvedValue(RESPOSTA)

      await buscarLogado()

      expect(await screen.findByText('Remote from Brazil')).toBeInTheDocument()
      expect(screen.getByText('Not from Brazil')).toBeInTheDocument()
      expect(screen.getByText('Remote from Brazil: not stated')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: /Why: remote from Brazil/ }))
      expect(screen.getByText('Open to candidates anywhere in Latin America.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Why: not from Brazil/ }))
      expect(screen.getByText('Remote (US only).')).toBeInTheDocument()
    })

    it('o filtro mostra so as de veredito sim, e diz quantas ficaram sem resposta', async () => {
      mockApi.verificarRemoto.mockResolvedValue(RESPOSTA)
      await buscarLogado()
      await screen.findByText('Remote from Brazil')

      await userEvent.click(screen.getByLabelText('Only jobs I can do from Brazil'))

      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        'Aceita Brasil',
      ])
      // "Nao diz" e "nao foi possivel ler" somam 2 — e a tela diz isso.
      expect(
        screen.getByText(/Showing 1 on this page\. Hidden: 1 not open to Brazil, and 2 with no answer/),
      ).toBeInTheDocument()

      await userEvent.click(screen.getByLabelText('Only jobs I can do from Brazil'))
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
    })

    it('sem pais no perfil: a tela mostra o caminho para configurar, e nenhum selo', async () => {
      mockApi.verificarRemoto.mockResolvedValue({ estado: 'sem_pais', pais: null, vereditos: [] })

      await buscarLogado()

      const link = await screen.findByRole('link', { name: 'Set your country in your profile' })
      expect(link).toHaveAttribute('href', '/perfil')
      expect(screen.queryByLabelText(/Only jobs I can do from/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Checking/)).not.toBeInTheDocument()
    })

    it('interruptor desligado: a tela e a de antes — sem selo, sem filtro, sem erro', async () => {
      await buscarLogado()

      await waitFor(() => expect(mockApi.verificarRemoto).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByText(/^Checking/)).not.toBeInTheDocument())
      expect(screen.queryByLabelText(/Only jobs I can do from/)).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
    })

    it('a verificacao falhar nao quebra a lista nem mostra erro', async () => {
      mockApi.verificarRemoto.mockRejectedValue(new Error('500'))

      await buscarLogado()

      await waitFor(() => expect(mockApi.verificarRemoto).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByText(/^Checking/)).not.toBeInTheDocument())
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('pagina cheia vai em lotes de 5, e os selos do primeiro lote nao esperam o segundo', async () => {
      vagasDaBusca = Array.from({ length: 7 }, (_, i) =>
        vaga({ id: `v${i}`, title: `Vaga ${i}`, url: `https://x.example/${i}` }),
      )
      let soltarSegundo: (r: unknown) => void = () => {}
      mockApi.verificarRemoto
        .mockResolvedValueOnce({
          estado: 'ok',
          pais: 'Brazil',
          vereditos: [{ id: 'v0', veredito: 'sim', trecho: 'Work from anywhere.' }],
        })
        .mockReturnValueOnce(new Promise((ok) => (soltarSegundo = ok)))
      render(
        <SessaoContext.Provider value={QUEM_ENTROU}>
          <ListaVagas />
        </SessaoContext.Provider>,
      )
      await screen.findByRole('button', { name: 'Upload CV' })
      await userEvent.click(screen.getByRole('button', { name: 'Search' }))

      expect(await screen.findByText('Remote from Brazil')).toBeInTheDocument()
      await waitFor(() => expect(mockApi.verificarRemoto).toHaveBeenCalledTimes(2))
      expect(mockApi.verificarRemoto.mock.calls.map((c) => c[0])).toEqual([
        ['v0', 'v1', 'v2', 'v3', 'v4'],
        ['v5', 'v6'],
      ])
      // O segundo lote ainda esta no ar: so as duas dele dizem "Checking".
      expect(screen.getAllByText(/^Checking/)).toHaveLength(2)

      soltarSegundo({ estado: 'ok', pais: 'Brazil', vereditos: [] })
      await waitFor(() => expect(screen.queryByText(/^Checking/)).not.toBeInTheDocument())
    })

    it('sem sessao a verificacao nem e pedida', async () => {
      await buscarLogado(false)

      // Mais que a espera do hook: se fosse pedir, ja teria pedido.
      await new Promise((r) => setTimeout(r, 600))
      expect(mockApi.verificarRemoto).not.toHaveBeenCalled()
    })
  })
})
