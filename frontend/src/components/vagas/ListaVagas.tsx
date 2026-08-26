import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { WARN_INK } from '../blocks/BlockRenderer'
import { BarraDeBusca } from './BarraDeBusca'

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
export function ListaVagas() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [pagina, setPagina] = useState(1)
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
        else if (ev.tipo === 'erro') setErro(ev.mensagem ?? 'Search failed.')
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
      .recursos(ctrl.signal)
      .then((r) => {
        // A mesma resposta decide as duas coisas: um `GET /settings/recursos`
        // e não dois. Com a leitura desligada a caixa nem é montada — e o
        // servidor confere o mesmo interruptor, então esconder não é a
        // proteção, é só a cortesia.
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
      const juntar = (campo: string, valores: string[]): string[] =>
        Array.from(new Set([...(atual[campo] ?? []), ...valores.filter(Boolean)]))

      const novo = { ...atual }
      if (stack.length > 0) novo.technologies = juntar('technologies', stack)
      if (senioridade) novo.seniorities = juntar('seniorities', [senioridade])
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
  const [formatos, setFormatos] = useState<string[]>([])
  const [regioes, setRegioes] = useState<string[]>([])
  const [avancadosDaBarra, setAvancadosDaBarra] = useState<Record<string, string[]>>({})
  /**
   * O modal de filtros, montado aqui desde que a `BarraFiltros` saiu (26/08).
   *
   * Antes ele vivia dentro dela e era aberto por um contador de pedidos —
   * indireção que existia só porque o botão estava numa barra e o modal em
   * outra. Com um dono só, é um booleano.
   */
  const [modalAberto, setModalAberto] = useState(false)

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
    if (formatos.length > 0) f.work_modes = formatos
    if (regioes.length > 0) f.regions = regioes
    return f
  }, [textoDaBusca, formatos, regioes])

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

  return (
    <div className="flex flex-col gap-4">
      <BarraDeBusca
        texto={textoDaBusca}
        onTexto={setTextoDaBusca}
        formatos={formatos}
        regioes={regioes}
        onLocal={(f, r) => {
          setFormatos(f)
          setRegioes(r)
        }}
        quantosFiltros={
          Object.values(avancadosDaBarra).reduce<number>(
            (n, l) => n + (Array.isArray(l) ? l.length : 0),
            0,
          ) +
          formatos.length +
          regioes.length
        }
        onAbrirFiltros={() => setModalAberto(true)}
        onBuscar={(t) => void buscar(avancadosDaBarra, doTopo(t))}
      />

      {/*
        **A caixa de currículo sai da barra de filtros, que deixou de existir.**

        Ela vivia no `cabecalho` da `BarraFiltros` porque quem sabe se a
        leitura de CV está ligada é esta lista, não a barra (JOB-02). Com a
        barra removida (26/08), a caixa passa a ser filha direta daqui — o
        dono do estado nunca mudou.
      */}
      <CaixaUploadCV
        ativa={leituraCvAtiva}
        onLeu={aoLerCv}
        filtrosMarcados={filtrosDoCv}
        // Trocar de arquivo limpa o que o CV anterior marcou — e só isso: o
        // que a pessoa marcou à mão no modal fica. São gestos diferentes:
        // "adicionar" acumula, "substituir" substitui.
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
        O "N jobs found" também era da barra.

        `aria-live` porque, depois de buscar, esta é a única confirmação de
        que algo aconteceu — sem ela, quem usa leitor de tela busca e não ouve
        nada mudar. E só aparece DEPOIS de buscar: "0 jobs found" numa tela
        que ninguém pesquisou afirma um resultado que não houve.
      */}
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
          {vagas.length} {vagas.length === 1 ? 'job found' : 'jobs found'}
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

      {salvas && salvas.size > 0 && (
        // Um caminho para a aba, e não a lista aqui: buscar e reler o que se
        // guardou são momentos diferentes, e a tela de busca já disputa espaço
        // com oito filtros.
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          <Link
            to="/salvas"
            className="underline underline-offset-2"
            style={{ color: 'var(--brand)' }}
          >
            {salvas.size} saved {salvas.size === 1 ? 'job' : 'jobs'}
          </Link>
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

          {paginas > 1 && (
            <Paginacao
              atual={atual}
              paginas={paginas}
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
      {/* Só monta depois do clique — antes disso nem o chunk é baixado. */}
      {modalAberto && (
        <Suspense fallback={null}>
          <ModalFiltros
            aberto={modalAberto}
            selecaoInicial={avancadosDaBarra}
            onFechar={() => setModalAberto(false)}
            onAplicar={(sel) => {
              setAvancadosDaBarra(sel)
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
