import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { WARN_INK } from '../blocks/BlockRenderer'
import { AcoesDaBarra, BarraDeBusca, BOTAO_ICONE } from './BarraDeBusca'
import { HintWrap } from '../Hint'
import { PainelDeFiltros } from './PainelDeFiltros'
import { VagasSalvas } from './VagasSalvas'

/**
 * O modal entra por `import()` dinâmico.
 *
 * ~15 KB que só servem a quem clica em "All filters". Mesma decisão do jsPDF
 * no Invoice: o custo fica com quem usa a feature.
 */
const ModalFiltros = lazy(() =>
  import('./ModalFiltros').then((m) => ({ default: m.ModalFiltros })),
)
import { CaixaUploadCV } from './CaixaUploadCV'
import { LinhaVaga } from './LinhaVaga'
import { POR_PAGINA, Paginacao } from './Paginacao'
import type { MotivoDoFim } from './Paginacao'
import { api, ehSemSessao } from '../../lib/api'
import { buscarVagas } from '../../lib/busca-vagas'
import type { CvLido, Historico, Vaga } from '../../types/api'

type Estado = 'ocioso' | 'buscando' | 'pronto'

/**
 * O que a lista mostra em relação ao histórico (JOB-26).
 *
 * Três estados e não um checkbox "só novas": com dois, "descartadas" não teria
 * onde aparecer, e o descarte viraria irreversível na prática — a pessoa não
 * teria como achar o que escondeu para desfazer.
 */
type Recorte = 'todas' | 'novas' | 'descartadas'


/**
 * A busca de vagas: escolhe os filtros, clica em Filter, e a varredura acontece
 * na hora.
 *
 * **As vagas entram uma a uma, conforme são lidas.** Uma busca leva perto de um
 * minuto (medido no JOB-01: 12s para achar os anúncios, ~36s para ler cada
 * página), e um minuto de tela parada parece travamento. Com streaming, a
 * primeira vaga aparece em ~15s e a pessoa vê a lista crescer.
 *
 * Os dropdowns oferecem um catálogo fixo, e não o que já apareceu na tela: eles
 * alimentam a busca, não peneiram a página. Derivar as opções das vagas criava
 * um círculo — só dava para procurar "Kotlin" se alguma vaga visível já tivesse
 * Kotlin.
 */
/**
 * A senioridade do currículo no vocabulário da faceta do freehire.
 *
 * O CV fala o vocabulário brasileiro; a faceta fala o dela. Medido em 26/08 —
 * `pleno` e `estagio` **não existem** lá e devolvem zero, o que zera todas as
 * 25 facetas e deixa o modal em branco (o mesmo sintoma do cargo que ia para
 * `roles`):
 *
 * | valor     |   total |
 * | --------- | ------: |
 * | `estagio` |       0 |
 * | `pleno`   |       0 |
 * | `junior`  |  25.021 |
 * | `senior`  | 244.092 |
 */
const NIVEL_NO_FREEHIRE: Record<string, string> = {
  estagio: 'intern',
  junior: 'junior',
  pleno: 'middle',
  senior: 'senior',
  staff: 'staff',
  principal: 'principal',
}

export function ListaVagas({ verSalvas = false }: { verSalvas?: boolean }) {
  /**
   * Qual lista está na tela: as encontradas ou as salvas.
   *
   * A estrela da barra alterna. Era uma aba própria na navegação (26/08) —
   * virou visão porque buscar e reler o que se guardou acontecem no mesmo
   * lugar, e trocar de aba perdia a busca em andamento.
   */
  const [vendoSalvas, setVendoSalvas] = useState(verSalvas)
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [pagina, setPagina] = useState(1)
  /**
   * A sessão de cache do servidor (JOB-45): o que permite pedir a página 2.
   *
   * `null` enquanto a busca não terminou, ou quando o motor que a serviu não
   * pagina (ATS, IA, Firecrawl) — nesses casos o botão simplesmente não existe.
   */
  const [sessao, setSessao] = useState<string | null>(null)
  const [temMais, setTemMais] = useState(false)
  /**
   * Quantas vagas existem no filtro, contra quantas já foram carregadas.
   *
   * A linha dizia `vagas.length` — o CARREGADO. Com a paginação sob demanda
   * (JOB-45) isso passou a mentir por omissão: "120 jobs found" quando há
   * 5.461 no filtro faz a pessoa achar que viu tudo e refinar um filtro que
   * não precisava mexer.
   *
   * `null` quando o motor não sabe dizer — a busca por ATS e por IA não têm
   * total, e aí a linha volta a mostrar só o que veio.
   */
  const [totalNoFiltro, setTotalNoFiltro] = useState<number | null>(null)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [motivoDoFim, setMotivoDoFim] = useState<MotivoDoFim>(null)
  /**
   * Erro do "Load more", separado do `erroSalva`.
   *
   * **Medido pelo QA em 27/08:** com a pessoa no rodapé (scrollY≈1195), a
   * mensagem nascia em `y=-897` — 900px acima da janela. O botão sumia e o
   * único texto que explicava por quê estava fora do campo de visão, então o
   * clique parecia não ter feito nada.
   *
   * São dois gestos em lugares diferentes da página: salvar/descartar
   * acontece na linha, e paginar acontece no rodapé. Um estado só fazia a
   * mensagem aparecer longe de onde o gesto foi — e os dois se sobrescreviam.
   */
  const [erroDeMais, setErroDeMais] = useState('')
  /** URLs já salvas. `null` enquanto não se sabe — a estrela não chuta. */
  const [salvas, setSalvas] = useState<Set<string> | null>(null)
  const [avisoSalva, setAvisoSalva] = useState('')
  const [erroSalva, setErroSalva] = useState('')
  const abortar = useRef<AbortController | null>(null)
  /** O histórico. `null` = desligado ou ainda carregando — sem selo, sem ×. */
  const [historico, setHistorico] = useState<Historico | null>(null)
  const [recorte, setRecorte] = useState<Recorte>('todas')
  /**
   * A última vaga descartada, para o desfazer imediato.
   *
   * **Um clique errado não pode esconder uma vaga para sempre.** O × fica
   * colado no ☆, e trocar um pelo outro é o erro óbvio desta tela. O undo
   * aparece na hora; quem só perceber depois acha a vaga no recorte
   * "Dismissed", que é o desfazer tardio.
   */
  const [ultimoDescarte, setUltimoDescarte] = useState<Vaga | null>(null)
  // O `rascunho` e o `origemCv` morreram com os dropdowns (26/08): eram o
  // estado que ELES renderizavam. O currículo agora escreve direto nos campos
  // do modal — ver `aoLerCv`.
  /** O que veio do CV, por eixo. Alimenta o selo "CV" nos dropdowns. */
  /** A leitura de CV está ligada no servidor. `undefined` = ainda não se sabe. */
  const [leituraCvAtiva, setLeituraCvAtiva] = useState<boolean | undefined>()

  /**
   * Dispara a busca.
   *
   * Dois argumentos desde que os dropdowns saíram (26/08): o que o modal
   * marcou e o que a barra do topo contribui. Antes havia um terceiro — a
   * `Selecao` dos oito eixos —, que deixou de existir junto com eles.
   */
  const buscar = useCallback(async (
    avancados?: Record<string, string[]>,
    doTopo?: Record<string, string[] | string>,
  ) => {
    // Uma busca por vez: sem isto, dois cliques em Filter escreveriam na mesma
    // lista e o resultado seria a mistura de duas consultas.
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl

    setErro(null)
    setVagas([])
    setTotal(null)
    // **A sessão morre com a busca antiga**, e é isso que impede a página 2 do
    // filtro novo de vir do cache do filtro velho. O servidor tem a mesma
    // guarda (a chave do cache inclui todos os filtros); aqui é a primeira, e
    // ela é a que evita a chamada inútil.
    setSessao(null)
    setTotalNoFiltro(null)
    setTemMais(false)
    setMotivoDoFim(null)
    // Busca nova começa da primeira página: ficar na 4 depois de trocar o
    // filtro mostraria uma página vazia e pareceria "sem resultado".
    setPagina(1)
    setEstado('buscando')

    try {
      // Os oito eixos da barra e os do modal viajam juntos: o backend recebe
      // um `FiltrosDto` só, e é ele quem sabe traduzir cada eixo para o motor.
      // **A ordem do spread é a precedência**, e o topo vem por último: o que
      // a pessoa digitou na barra grande ganha do dropdown, porque foi o
      // gesto mais recente e mais específico.
      // A ordem do spread é a precedência: o topo ganha do modal, porque foi
      // o gesto mais recente e mais específico.
      const filtros = { ...(avancados ?? {}), ...(doTopo ?? {}) }
      for await (const ev of buscarVagas(filtros, ctrl.signal)) {
        if (ctrl.signal.aborted) return
        if (ev.tipo === 'inicio') setTotal(ev.total ?? null)
        // A vaga entra assim que chega — este é o ponto do streaming.
        else if (ev.tipo === 'vaga' && ev.vaga) setVagas((v) => [...v, ev.vaga!])
        // O `fim` carrega a sessão de cache (JOB-45). Sem ela — motor que não
        // pagina, ou paginação desligada — `temMais` vem `false` e o botão
        // nem é montado.
        else if (ev.tipo === 'fim') {
          setSessao(ev.sessao ?? null)
          setTemMais(ev.temMais === true)
          setTotalNoFiltro(ev.totalNoFiltro ?? null)
        } else if (ev.tipo === 'erro') setErro(ev.mensagem ?? 'Search failed.')
      }
      setEstado('pronto')
    } catch (e) {
      // Abortar é o caminho normal quando a pessoa busca de novo; não é erro.
      if (!ctrl.signal.aborted) {
        setErro('Search failed. Try again in a moment.')
        setEstado('pronto')
      }
    }
  }, [])

  /**
   * Busca a próxima página do servidor (JOB-45).
   *
   * **Acrescenta ao que já está na tela, e não substitui.** É o que a palavra
   * "cache" do pedido significa na prática: a pessoa vai buscando aos poucos, e
   * o que já veio continua ali — voltar para a página 1 depois de carregar mais
   * mostra as mesmas vagas de antes.
   *
   * **Não muda a página sozinho.** Carregar 60 vagas na página 3 e saltar para
   * a 5 tiraria a pessoa de onde ela estava lendo. A `Paginacao` passa a
   * oferecer mais números, e ela clica se quiser.
   */
  const carregarMais = useCallback(async () => {
    if (!sessao || carregandoMais) return
    setCarregandoMais(true)
    setErroSalva('')
    try {
      setErroDeMais('')
      const r = await api.maisVagas(sessao)
      if (r.expirada) {
        // O cache de 10 minutos venceu (ou a requisição caiu noutra
        // instância). **Não é erro**: a sessão simplesmente não existe mais.
        // A tela para de oferecer o botão e diz o que fazer, em vez de
        // disparar uma busca que a pessoa não pediu — refazer sozinho
        // gastaria uma varredura inteira por um clique em "load more".
        setSessao(null)
        setTemMais(false)
        setMotivoDoFim(null)
        setErroDeMais(
          'This search expired after 10 minutes. Search again to load more jobs.',
        )
        return
      }
      // O dedup de verdade é do servidor, que guarda as URLs entregues na
      // sessão. Este `Set` é o cinto: um clique duplo no botão não pode
      // duplicar linha na tela enquanto a primeira resposta não voltou.
      setVagas((atuais) => {
        const jaTem = new Set(atuais.map((v) => v.url))
        return [...atuais, ...r.vagas.filter((v) => !jaTem.has(v.url))]
      })
      setTemMais(r.temMais)
      setMotivoDoFim(r.motivo)
      // O total pode mudar entre uma página e outra — o catálogo é vivo. E
      // quando o servidor não sabe dizer, mantém o que já se sabia em vez de
      // apagar o número que estava na tela.
      if (r.totalNoFiltro !== null) setTotalNoFiltro(r.totalNoFiltro)
    } catch {
      setErroDeMais('Could not load more jobs. Check your connection and try again.')
    } finally {
      setCarregandoMais(false)
    }
  }, [sessao, carregandoMais])

  // Busca em andamento não sobrevive à saída da página: sem isto, a requisição
  // continua rodando e gastando crédito depois de a tela sumir.
  useEffect(() => () => abortar.current?.abort(), [])

  // Quais já estão salvas. Sem sessão a lista simplesmente não existe, e a
  // estrela some — em vez de aparecer e falhar no clique.
  useEffect(() => {
    const ctrl = new AbortController()
    api
      .listarSalvas(ctrl.signal)
      .then((lista) => setSalvas(new Set(lista.map((v) => v.url))))
      .catch((e) => {
        if (!ctrl.signal.aborted && !ehSemSessao(e)) setSalvas(new Set())
      })
    return () => ctrl.abort()
  }, [])

  /**
   * O histórico — mas só se o recurso estiver ligado.
   *
   * **O interruptor é consultado ANTES de buscar o histórico**, e não depois:
   * com o recurso desligado a tela não deve nem pedir a lista. É o que faz
   * `historico` continuar `null`, e `null` é exatamente o estado que esconde o
   * selo e o × — a tela volta a ser a de antes do JOB-26 sem nenhum outro
   * `if`.
   *
   * Falha silenciosa de propósito: uma lista de vagas não deve mostrar erro
   * porque o histórico não carregou.
   */
  useEffect(() => {
    const ctrl = new AbortController()
    api
      .recursosDeProduto(ctrl.signal)
      .then((r) => {
        // A mesma resposta decide as duas coisas: um
        // `GET /settings/recursos/produto` e não dois. Com a leitura desligada
        // a caixa nem é montada — e o servidor confere o mesmo interruptor,
        // então esconder não é a proteção, é só a cortesia.
        //
        // A rota é a de PRODUTO, e não `/settings/recursos`: aquela é
        // `@AdminOnly()` desde o PLT-12, e chamá-la aqui daria 403 para todo
        // usuário comum — que é exatamente quem usa esta tela.
        setLeituraCvAtiva(r.leituraCvAtiva)
        return r.historicoAtivo ? api.listarHistorico(ctrl.signal) : null
      })
      .then((h) => {
        if (h) setHistorico(h)
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  /**
   * O currículo lido vira marcação nos dropdowns.
   *
   * **Acrescenta ao que já estava marcado, e nada fica travado**: os checkbox
   * continuam os mesmos, e desmarcar um valor que veio do CV é um clique — que
   * é exatamente o ponto do card. A pessoa vê o que o sistema entendeu dela e
   * corrige.
   *
   * A origem se acumula entre uploads (`{...anterior}`) porque subir um
   * segundo currículo não desfaz o primeiro: os valores dos dois continuam
   * marcados, e o selo tem de continuar valendo para os dois.
   */
  /**
   * O currículo preenche os filtros do MODAL (26/08).
   *
   * **Antes escrevia num `rascunho` que os dropdowns renderizavam** — e os
   * dropdowns saíram. O QA mediu o estrago: os 15 valores lidos do CV
   * continuavam viajando em toda busca, invisíveis na tela, e `Clear all` não
   * os alcançava porque o modal usa outro estado. A busca ficava presa ao
   * currículo até um F5, e a caixa ainda instruía "uncheck anything we got
   * wrong" — uma ação que não existia mais.
   *
   * Agora escreve onde a pessoa consegue ver e desmarcar: `roles`,
   * `technologies` e `seniorities` são os mesmos campos que os chips do modal
   * usam, então o que o CV marcou aparece marcado lá.
   */
  const aoLerCv = useCallback((lido: CvLido) => {
    const cargos = lido.filtrosSugeridos.job_titles ?? []
    const stack = lido.cvProfile.stack ?? []
    const senioridade = lido.cvProfile.senioridade

    // **O cargo vai para o campo de busca, e não para o filtro `roles`.**
    //
    // `roles` é faceta de vocabulário fechado: exige o slug (`backend`), e o
    // currículo devolve o título legível ("Backend Engineer"). Medido em
    // 26/08, depois de o QA achar o modal em branco:
    //
    // | consulta                            |  total |
    // | ----------------------------------- | -----: |
    // | `roles=["Backend Engineer"]`        |      0 |
    // | `roles=["backend"]`                 | 27.077 |
    // | `job_titles=["Backend Engineer"]`   | 80.403 |
    //
    // O zero não dava erro: zerava todas as facetas, e o modal lia isso como
    // "indisponível" — a mensagem mandava revisar em "All filters" e a tela
    // abria vazia. `job_titles` é full-text e aceita o título como ele veio.
    //
    // E o campo de busca é onde a pessoa VÊ o cargo e consegue apagá-lo, que
    // era a promessa quebrada do bug original.
    if (cargos[0]) setTextoDaBusca(cargos[0])

    setAvancadosDaBarra((atual) => {
      // **Acumula, não substitui.** É a promessa do JOB-02: quem já tinha
      // marcado algo à mão não perde por subir um currículo.
      //
      // O corte em 20 é o `ArrayMaxSize` do `FiltrosDto`, e ele MORDE: um
      // currículo com 21 tecnologias devolvia **400**, e a tela mostrava
      // "Something went wrong with this filter combination" ao abrir os
      // filtros (26/08). Currículo com 25 stacks é comum.
      //
      // Cortar as últimas, e não as primeiras: a extração devolve as mais
      // relevantes na frente.
      const juntar = (campo: string, valores: string[]): string[] =>
        Array.from(
          new Set([...(atual[campo] ?? []), ...valores.filter(Boolean)]),
        ).slice(0, 20)

      const novo = { ...atual }
      if (stack.length > 0) novo.technologies = juntar('technologies', stack)
      // **A senioridade é traduzida.** O CV fala o vocabulário brasileiro
      // (`pleno`, `estagio`) e a faceta do freehire fala o dela (`middle`,
      // `intern`). Sem a tradução, um CV de nível pleno zerava as 25 facetas
      // e o modal abria vazio — o mesmo sintoma do cargo que ia para `roles`.
      const nivel = senioridade ? NIVEL_NO_FREEHIRE[senioridade] : undefined
      if (nivel) novo.seniorities = juntar('seniorities', [nivel])
      return novo
    })
  }, [])

  /**
   * Descarta a vaga. **Sem otimismo, ao contrário da estrela.**
   *
   * A estrela é reversível no mesmo clique e o pior caso é uma estrela errada
   * por um segundo. Aqui a vaga SOME da lista — sumir e reaparecer depois que
   * a rede falha é pior que esperar 200ms para ela sumir de verdade. E o
   * servidor devolve o histórico inteiro, que é a fonte da verdade.
   */
  const descartar = useCallback(async (vaga: Vaga) => {
    setErroSalva('')
    try {
      setHistorico(await api.marcarVaga(vaga, 'descartado'))
      setUltimoDescarte(vaga)
      setAvisoSalva(`${vaga.title} dismissed.`)
    } catch {
      setErroSalva(`Could not dismiss "${vaga.title}". Check your connection and try again.`)
    }
  }, [])

  /** Desfaz: sem linha no histórico, a vaga volta a ser nova. */
  const restaurar = useCallback(async (url: string, titulo: string) => {
    setErroSalva('')
    try {
      setHistorico(await api.desmarcarVaga(url))
      setUltimoDescarte((u) => (u?.url === url ? null : u))
      setAvisoSalva(`${titulo} restored.`)
    } catch {
      setErroSalva(`Could not restore "${titulo}". Check your connection and try again.`)
    }
  }, [])

  /**
   * Abrir o anúncio é o que marca a vaga como vista.
   *
   * **Não é automático por aparecer na tela**: a pessoa rola por 25 vagas e lê
   * 3, e marcar as 25 esconderia 22 que ela nunca leu. Abrir é o único gesto
   * desta tela que prova atenção — e já acontece de qualquer jeito, então não
   * custa um clique a mais.
   *
   * Falha em silêncio: o anúncio já abriu em outra aba, e um erro sobre o selo
   * "New" seria ruído sobre uma ação que deu certo.
   */
  const marcarVista = useCallback((vaga: Vaga) => {
    api
      .marcarVaga(vaga, 'visto')
      .then(setHistorico)
      .catch(() => {})
  }, [])

  /**
   * Salva ou remove, com atualização otimista.
   *
   * A estrela muda na hora e volta atrás se a chamada falhar. É o padrão que
   * a aula concluída já usa: um clique reversível e barato não deve esperar
   * a rede para dar retorno.
   */
  const alternarSalva = useCallback(async (vaga: Vaga, salvar: boolean) => {
    setSalvas((atual) => {
      const proximo = new Set(atual ?? [])
      if (salvar) proximo.add(vaga.url)
      else proximo.delete(vaga.url)
      return proximo
    })
    setAvisoSalva(salvar ? `${vaga.title} saved.` : `${vaga.title} removed from saved.`)
    setErroSalva('')
    try {
      if (salvar) await api.salvarVaga(vaga)
      else await api.removerSalva(vaga.url)
    } catch (e) {
      // 404 ao remover é a vaga já não estar salva — o estado da tela já é o
      // desejado, e desfazer faria a estrela reacender sozinha.
      if (!salvar && e instanceof AxiosError && e.response?.status === 404) return

      // Rollback: a estrela não pode dizer "salvo" quando não salvou.
      setSalvas((atual) => {
        const proximo = new Set(atual ?? [])
        if (salvar) proximo.delete(vaga.url)
        else proximo.add(vaga.url)
        return proximo
      })
      setAvisoSalva(`Could not ${salvar ? 'save' : 'remove'} ${vaga.title}.`)
      setErroSalva(
        `Could not ${salvar ? 'save' : 'remove'} "${vaga.title}". Check your connection and try again.`,
      )
    }
  }, [])

  const vistas = useMemo(
    () => new Set(historico?.vistas ?? []),
    [historico],
  )
  const descartadas = useMemo(
    () => new Set(historico?.descartadas.map((d) => d.url) ?? []),
    [historico],
  )

  /**
   * A lista depois do histórico.
   *
   * **Descartada some de "All" também**, e não só de "New": "some da lista e
   * não volta" é o critério do card, e uma vaga descartada que continua na
   * aba principal não foi descartada — foi anotada.
   */
  const filtradas = useMemo(() => {
    if (recorte === 'descartadas') return vagas.filter((v) => descartadas.has(v.url))
    const semDescarte = vagas.filter((v) => !descartadas.has(v.url))
    if (recorte === 'novas') return semDescarte.filter((v) => !vistas.has(v.url))
    return semDescarte
  }, [vagas, recorte, vistas, descartadas])

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  // A página nunca passa do fim: se a lista encolheu enquanto a busca
  // streamava — ou porque um descarte a encurtou —, `pagina` poderia apontar
  // para o vazio.
  const atual = Math.min(pagina, paginas)
  const visiveis = useMemo(
    () => filtradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA),
    [filtradas, atual],
  )
  /**
   * Quantos valores foram marcados a partir do currículo — a soma dos valores
   * por eixo, não a quantidade de eixos.
   *
   * É o que a linha de sucesso da `CaixaUploadCV` nomeia, e é o mesmo conjunto
   * que carrega o selo "CV" nos dropdowns: o número na confirmação e os selos
   * na barra contam a mesma coisa, então desmarcar um valor derruba os dois
   * juntos. Contar eixos daria "3 filters" onde a barra mostra oito selos.
   */
  // A barra de busca do topo (JOB-43): texto livre + local, que viajam junto
  // dos filtros da barra e do modal na mesma chamada.
  const [textoDaBusca, setTextoDaBusca] = useState('')
  const [avancadosDaBarra, setAvancadosDaBarra] = useState<Record<string, string[]>>({})
  // **`formatos` e `regioes` NÃO são estado separado** (26/08).
  //
  // Eram, e o QA mediu o estrago: o painel dizia "No filters yet" com a busca
  // filtrada por local, o badge não contava, e o modal não mostrava marcado —
  // um comentário meu afirmava o contrário. Agora vivem dentro de
  // `avancadosDaBarra`, nos mesmos campos que o modal usa, e há uma fonte só.
  const formatos = avancadosDaBarra.work_modes ?? []
  const regioes = avancadosDaBarra.regions ?? []
  /**
   * O modal de filtros, montado aqui desde que a `BarraFiltros` saiu (26/08).
   *
   * Antes ele vivia dentro dela e era aberto por um contador de pedidos —
   * indireção que existia só porque o botão estava numa barra e o modal em
   * outra. Com um dono só, é um booleano.
   */
  const [modalAberto, setModalAberto] = useState(false)
  // **A faixa de filtros não tem mais estado de abertura** (27/08, JOB-40).
  //
  // Ela era uma gaveta: `painelFixado` + `painelEmHover`, abertos por uma
  // etiqueta de chevron pendurada sob a barra. A etiqueta media 160×24 e não
  // tinha rótulo, e o custo real era outro — os filtros só existiam para quem
  // descobrisse o botão. Agora a faixa é sempre visível dentro do quadro da
  // barra, então não há o que abrir nem fechar.
  /** Abrir o modal já no formulário de salvar — ver `onSalvar` no painel. */
  const [salvarAoAbrir, setSalvarAoAbrir] = useState(false)
  // `useSessao` saiu daqui em 27/08: o unico uso era esconder o "Save filter"
  // da gaveta de filtros, que deixou de existir. O modal tem o proprio botao
  // de salvar, e ele ja checa a sessao.

  /** Quantos filtros estão ativos, contando o texto da busca. */
  const quantosAtivos =
    Object.values(avancadosDaBarra).reduce<number>(
      (n, l) => n + (Array.isArray(l) ? l.length : 0),
      0,
    ) + (textoDaBusca.trim() ? 1 : 0)

  /**
   * O que a barra do topo contribui para a consulta.
   *
   * `work_modes` e `regions` são os MESMOS campos que o modal usa — marcar
   * "Remote" aqui aparece marcado lá, porque é o mesmo filtro visto de dois
   * lugares, e não dois filtros parecidos.
   */
  const doTopo = useCallback((texto?: string): Record<string, string[] | string> => {
    const f: Record<string, string[] | string> = {}
    // O texto vem por parâmetro quando quem chama já sabe o valor novo — o
    // `×`, que limpa e busca no mesmo clique. Sem ele, cai no estado.
    const t = (texto ?? textoDaBusca).trim()
    if (t) f.job_titles = [t]
    // O local NÃO entra aqui: ele agora vive em `avancadosDaBarra`, e
    // repeti-lo faria o mesmo valor viajar duas vezes.
    return f
  }, [textoDaBusca])

  /**
   * Quantos filtros o currículo marcou — o número da mensagem da caixa.
   *
   * Conta o que o CV escreveu nos campos do modal, e não um `origemCv`
   * separado: aquele existia para o selo "from your CV" nos dropdowns, que
   * saíram. Contar a fonte da verdade evita o número divergir do que está
   * marcado de fato.
   */
  const filtrosDoCv = useMemo(
    () =>
      (['technologies', 'seniorities'] as const).reduce(
        (total, campo) => total + (avancadosDaBarra[campo]?.length ?? 0),
        0,
      ),
    [avancadosDaBarra],
  )
  const novasNaBusca = useMemo(
    () => vagas.filter((v) => !descartadas.has(v.url) && !vistas.has(v.url)).length,
    [vagas, vistas, descartadas],
  )

  /**
   * Zera a busca inteira e rebusca.
   *
   * Está numa constante porque tem DOIS gatilhos desde o redesenho: o botão de
   * limpar tudo, na linha de ações, e o `Clear all` da faixa de chips. Dois
   * corpos iguais divergiriam na primeira mudança.
   */
  const limparTudo = () => {
    setTextoDaBusca('')
    setAvancadosDaBarra({})
    // Busca de novo já: limpar promete voltar ao catálogo inteiro, e deixar a
    // lista filtrada na tela contradiz isso — a mesma regra do `×` do campo.
    void buscar({}, {})
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        As ações que NÃO executam a busca, numa linha acima do console.

        Estavam dentro da barra, disputando a faixa com os controles que mudam
        o resultado — e no celular empurravam o campo de texto para a terceira
        linha.
      */}
      <AcoesDaBarra
        temAlgumFiltro={quantosAtivos > 0}
        onLimparTudo={limparTudo}
        acoes={
          <>
            {/* O upload de CV, como ícone. O componente decide se aparece —
                ele já sabe se a leitura de CV está ligada. */}
            <CaixaUploadCV
              ativa={leituraCvAtiva}
              onLeu={aoLerCv}
              filtrosMarcados={filtrosDoCv}
              onSubstituir={() => {
                setTextoDaBusca('')
                setAvancadosDaBarra((a) => {
                  const novo = { ...a }
                  delete novo.technologies
                  delete novo.seniorities
                  return novo
                })
              }}
            />

            {/*
              As vagas salvas, com a contagem no badge.

              Era um link de texto embaixo da lista; virou botão na barra
              (26/08). Continua sendo um CAMINHO para a aba, e não a lista
              aqui: buscar e reler o que se guardou são momentos diferentes.
            */}
            {salvas && salvas.size > 0 && (
              <HintWrap
                title="Saved jobs"
                align="left"
                texto="Jobs you starred. They are kept for good — the 15-day rule does not apply to them."
              >
                <button
                  type="button"
                  onClick={() => setVendoSalvas((v) => !v)}
                  aria-pressed={vendoSalvas}
                  aria-label={
                    vendoSalvas
                      ? 'Back to search results'
                      : `${salvas.size} saved ${salvas.size === 1 ? 'job' : 'jobs'}`
                  }
                  className={`h-9 gap-1.5 px-2 ${BOTAO_ICONE}`}
                  style={{ color: vendoSalvas ? 'var(--brand)' : 'var(--text-muted)' }}
                >
                  <IconeEstrela />
                  <span
                    className="rounded-full px-1.5 text-xs tabular-nums"
                    style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
                  >
                    {salvas.size}
                  </span>
                </button>
              </HintWrap>
            )}
          </>
        }
      />

      <BarraDeBusca
        texto={textoDaBusca}
        onTexto={setTextoDaBusca}
        formatos={formatos}
        regioes={regioes}
        onLocal={(f, r) =>
          setAvancadosDaBarra((a) => {
            const novo = { ...a }
            if (f.length > 0) novo.work_modes = f
            else delete novo.work_modes
            if (r.length > 0) novo.regions = r
            else delete novo.regions
            return novo
          })
        }
        quantosFiltros={quantosAtivos}
        onAbrirFiltros={() => setModalAberto(true)}
        onBuscar={(t) => void buscar(avancadosDaBarra, doTopo(t))}
        /*
          A faixa de chips, dentro do quadro da barra.

          Vai por prop e nao como irmao logo abaixo: as duas faixas sao UM
          objeto com uma borda so, e um segundo bloco empilhado leria como
          barra + caixa.
        */
        faixa={
          <PainelDeFiltros
            texto={textoDaBusca}
            selecao={avancadosDaBarra}
            onTexto={(t) => {
              setTextoDaBusca(t)
              void buscar(avancadosDaBarra, doTopo(t))
            }}
            onSelecao={(sel) => {
              setAvancadosDaBarra(sel)
              // Remover um chip rebusca na hora: a faixa e para desfazer, e
              // desfazer que nao muda a lista nao desfez nada.
              void buscar(sel, doTopo())
            }}
            onLimparTudo={limparTudo}
          />
        }
      />

      <div className="flex flex-col gap-4">
        {vendoSalvas ? (
          <VagasSalvas />
        ) : (
          <>
      {/*
        **Uma mensagem, e não três.** Havia três blocos verdadeiros ao mesmo
        tempo, e um deles mentia: "the list below is from your previous search"
        aparecia depois de `setVagas([])`, com a lista já vazia (QA, 26/08).
        Dois `role="status"` juntos também disparavam em dobro no leitor de
        tela.

        Só aparece DEPOIS de buscar: "0 jobs found" numa tela que ninguém
        pesquisou afirma um resultado que não houve.
      */}
      {estado !== 'ocioso' && estado !== 'buscando' && !erro && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {/*
            **Dois números quando eles divergem**: o que está na tela e o que
            existe no filtro. "120 of 5,461 jobs" diz, sem precisar de mais
            texto, que rolar adiante ainda traz coisa nova — que é justamente
            o que o botão "Load more" oferece no rodapé.

            Quando o motor não sabe o total (ATS, IA), ou quando já se
            carregou tudo, volta a ser um número só: repetir "120 of 120"
            gasta atenção para não dizer nada.
          */}
          {totalNoFiltro !== null && totalNoFiltro > vagas.length
            ? `${vagas.length.toLocaleString('en-US')} of ${totalNoFiltro.toLocaleString('en-US')} jobs`
            : `${vagas.length.toLocaleString('en-US')} ${vagas.length === 1 ? 'job found' : 'jobs found'}`}
        </p>
      )}

      {erro && (
        <p role="alert" className="text-sm" style={{ color: WARN_INK }}>
          {erro}
        </p>
      )}

      {/* `aria-live` em vez de toast: quem usa leitor de tela ouve a
          confirmação, e quem não usa não precisa caçar uma mensagem que some
          antes de ser lida. */}
      <p aria-live="polite" className="sr-only">
        {avisoSalva}
      </p>

      {erroSalva && (
        <p role="alert" className="text-sm" style={{ color: WARN_INK }}>
          {erroSalva}
        </p>
      )}

      {estado === 'buscando' && (
        // `role="status"` e não `alert`: é progresso, não urgência — o leitor
        // de tela anuncia sem interromper o que a pessoa está fazendo.
        <p
          role="status"
          aria-live="polite"
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {total === null
            ? 'Searching job boards…'
            : `Reading ${total} listings — ${vagas.length} done`}
        </p>
      )}

      {ultimoDescarte && (
        // O desfazer imediato. Fica FORA do `historico &&` de baixo porque
        // precisa sobreviver ao recorte mudar — quem descarta em "All" e a
        // lista encurta ainda tem o undo à mão.
        <p
          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Dismissed “{ultimoDescarte.title}”.
          </span>
          <button
            type="button"
            onClick={() => void restaurar(ultimoDescarte.url, ultimoDescarte.title)}
            className="min-h-6 underline underline-offset-2"
            style={{ color: 'var(--brand)' }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setUltimoDescarte(null)}
            aria-label="Dismiss this message"
            className="ml-auto min-h-6 px-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <span aria-hidden>×</span>
          </button>
        </p>
      )}

      {historico && vagas.length > 0 && (
        // `radiogroup` e não três botões soltos: são opções mutuamente
        // exclusivas sobre a MESMA lista, e o leitor de tela precisa anunciar
        // "1 de 3", não três botões sem relação.
        <div role="radiogroup" aria-label="Filter by history" className="flex flex-wrap gap-2">
          {(
            [
              ['todas', `All (${vagas.length - descartadas.size >= 0 ? vagas.filter((v) => !descartadas.has(v.url)).length : 0})`],
              ['novas', `New (${novasNaBusca})`],
              ['descartadas', `Dismissed (${vagas.filter((v) => descartadas.has(v.url)).length})`],
            ] as const
          ).map(([valor, rotulo]) => {
            const ativo = recorte === valor
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                // **Roving tabindex + setas.** `role="radiogroup"` promete que
                // as setas andam entre as opções e que só uma é tabbable; sem
                // isso o Tab visita as três e o leitor de tela anuncia um
                // grupo que não se comporta como grupo (QA, 24/08).
                tabIndex={ativo ? 0 : -1}
                onKeyDown={(e) => {
                  const ordem = ['todas', 'novas', 'descartadas'] as const
                  const i = ordem.indexOf(valor)
                  const passo =
                    e.key === 'ArrowRight' || e.key === 'ArrowDown'
                      ? 1
                      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                        ? -1
                        : 0
                  if (passo === 0) return
                  e.preventDefault()
                  const proximo = ordem[(i + passo + ordem.length) % ordem.length]
                  setRecorte(proximo)
                  setPagina(1)
                  // O foco acompanha a seleção — é o que faz a seta parecer
                  // navegação, e não um atalho invisível.
                  const alvo = e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                    `[data-recorte="${proximo}"]`,
                  )
                  alvo?.focus()
                }}
                data-recorte={valor}
                onClick={() => {
                  setRecorte(valor)
                  // Trocar de recorte volta para a primeira página: ficar na 3
                  // de uma lista que encolheu mostraria vazio e pareceria
                  // "sem resultado".
                  setPagina(1)
                }}
                className="min-h-6 rounded-md border px-3 py-1 text-sm"
                style={
                  ativo
                    ? { borderColor: 'var(--brand)', color: 'var(--brand)', fontWeight: 600 }
                    : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                }
              >
                {rotulo}
              </button>
            )
          })}
        </div>
      )}

      {vagas.length > 0 && (
        <>
          {recorte === 'descartadas' && filtradas.length > 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              These are hidden from your list. Restore any of them to bring it back.
            </p>
          )}

          <ul className="flex flex-col border-t" style={{ borderColor: 'var(--border)' }}>
            {visiveis.map((vaga) => (
              // No recorte "Dismissed" a linha ganha o caminho de volta. É o
              // desfazer TARDIO — quem só percebeu o clique errado depois de o
              // aviso de undo sumir encontra a vaga aqui.
              recorte === 'descartadas' ? (
                <li key={vaga.id} className="flex flex-col">
                  {/* A estrela vem junto: sem ela, uma vaga salva E descartada
                      ficava presa na aba Saved — só dava para dessalvar
                      restaurando antes (QA, 24/08). Salvar e descartar são
                      eixos independentes, e a linha precisa oferecer os dois. */}
                  <LinhaVaga
                    vaga={vaga}
                    salva={salvas?.has(vaga.url)}
                    onAlternarSalva={salvas ? alternarSalva : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => void restaurar(vaga.url, vaga.title)}
                    className="mb-4 min-h-6 self-start underline underline-offset-2"
                    style={{ color: 'var(--brand)' }}
                  >
                    Restore “{vaga.title}”
                  </button>
                </li>
              ) : (
              <LinhaVaga
                key={vaga.id}
                vaga={vaga}
                salva={salvas?.has(vaga.url)}
                // Sem a lista carregada não há estrela: melhor ausente que
                // mostrando um estado que pode estar errado.
                onAlternarSalva={salvas ? alternarSalva : undefined}
                // Sem histórico não há selo nem ×: a tela volta a ser a de
                // antes do JOB-26, em vez de oferecer um botão que não grava.
                nova={historico ? !vistas.has(vaga.url) : undefined}
                onAbrir={historico ? marcarVista : undefined}
                // O × só existe aqui: no recorte "Dismissed" a linha é
                // renderizada pelo outro braço, com o botão Restore no lugar.
                onDescartar={historico ? (v) => void descartar(v) : undefined}
              />
              )
            ))}
          </ul>

          {/*
            **`paginas > 1` sozinho não serve mais** (JOB-45). Uma busca com
            filtro apertado devolve 12 vagas — uma página — e ainda assim pode
            ter mais para buscar. Escondendo a navegação, o botão "Load more"
            desapareceria justamente na busca que mais precisa dele.
          */}
          {(paginas > 1 || temMais || motivoDoFim) && (
            <Paginacao
              atual={atual}
              paginas={paginas}
              temMais={temMais}
              carregandoMais={carregandoMais}
              motivo={motivoDoFim}
              erro={erroDeMais}
              onMais={() => void carregarMais()}
              // O total do rodapé é o do FILTRO, não o da busca: com 30 vagas
              // e 3 descartadas, os selos diziam "All (27)" e o rodapé "30
              // jobs" (QA, 24/08). Dois números para a mesma lista.
              total={filtradas.length}
              onIr={(p) => {
                setPagina(p)
                // Trocar de página sem subir deixa a pessoa no meio da lista
                // nova, lendo a partir da vaga 13 sem saber por quê.
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          )}
        </>
      )}

      {/* Vazio POR CAUSA DO RECORTE, e não da busca. Sem esta distinção,
          "New (0)" mostraria a mensagem de "nenhuma vaga encontrada" logo
          abaixo de uma busca que achou 40 — e a pessoa concluiria que a busca
          falhou. */}
      {vagas.length > 0 && filtradas.length === 0 && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {recorte === 'novas'
            ? 'No new jobs here — you have already opened all of these. Switch to All to see them again.'
            : 'Nothing dismissed yet.'}
        </p>
      )}

      {estado === 'pronto' && vagas.length === 0 && !erro && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No jobs matched. Try fewer filters or a broader job title.
        </p>
      )}
          </>
        )}
      </div>

      {/* Só monta depois do clique — antes disso nem o chunk é baixado. */}
      {modalAberto && (
        <Suspense fallback={null}>
          <ModalFiltros
            aberto={modalAberto}
            selecaoInicial={avancadosDaBarra}
            salvarAoAbrir={salvarAoAbrir}
            onFechar={() => {
              setModalAberto(false)
              setSalvarAoAbrir(false)
            }}
            onAplicar={(sel) => {
              setAvancadosDaBarra(sel)
              // Nao ha mais painel para abrir: a faixa de chips esta sempre
              // visivel, entao o que foi escolhido aparece sozinho.
              // Aplicar no modal dispara a busca: quem clicou em "Show jobs"
              // pediu para ver as vagas, e não para fechar e clicar de novo.
              void buscar(sel, doTopo())
            }}
          />
        </Suspense>
      )}

    </div>
  )
}


/** Estrela cheia — a mesma marca que a linha de vaga usa para "salva". */
function IconeEstrela() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9z" />
    </svg>
  )
}
