import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { WARN_INK } from '../blocks/BlockRenderer'
import { BarraFiltros } from './BarraFiltros'
import { CaixaUploadCV } from './CaixaUploadCV'
import { LinhaVaga } from './LinhaVaga'
import { POR_PAGINA, Paginacao } from './Paginacao'
import { api, ehSemSessao } from '../../lib/api'
import { buscarVagas } from '../../lib/busca-vagas'
import { SELECAO_VAZIA, aplicarCv, paraFiltrosApi } from './vaga-filtro'
import type { OrigemCv, Selecao } from './vaga-filtro'
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
  /**
   * O rascunho dos filtros, que era estado da `BarraFiltros`.
   *
   * Subiu para cá no JOB-02: a caixa de currículo precisa escrever nos
   * dropdowns, e o irmão não alcança o estado interno do outro. Continua
   * rascunho — só o botão "Filter" o transforma em busca.
   */
  const [rascunho, setRascunho] = useState<Selecao>(SELECAO_VAZIA)
  // Espelho do rascunho para quem lê fora do render — hoje o `aoLerCv`, que
  // resolve segundos depois do clique e não pode usar a closure daquele
  // momento. Ver o comentário lá.
  const rascunhoRef = useRef(rascunho)
  rascunhoRef.current = rascunho
  /** O que veio do CV, por eixo. Alimenta o selo "CV" nos dropdowns. */
  const [origemCv, setOrigemCv] = useState<OrigemCv>({})
  /** A leitura de CV está ligada no servidor. `undefined` = ainda não se sabe. */
  const [leituraCvAtiva, setLeituraCvAtiva] = useState<boolean | undefined>()

  const buscar = useCallback(async (selecao: Selecao) => {
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
      for await (const ev of buscarVagas(paraFiltrosApi(selecao), ctrl.signal)) {
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
  const aoLerCv = useCallback(
    (lido: CvLido) => {
      // **O rascunho vem de um ref, não da closure.**
      //
      // Medido pelo QA em 25/08: marcar "Kotlin" à mão DURANTE a leitura do
      // currículo e esperar — Kotlin sumia, sem aviso. A `CaixaUploadCV`
      // captura `onLeu` no clique, então a versão que roda na resolução
      // carregava o rascunho de ANTES do upload, e o `setRascunho` o
      // sobrescrevia. Perda silenciosa de escolha da pessoa, e o card promete
      // o contrário: "acrescenta ao que já estava marcado".
      //
      // O updater funcional resolveria a corrida mas traz outro problema: são
      // DOIS estados saindo do mesmo cálculo, e chamar `setOrigemCv` dentro de
      // um updater é efeito colateral num reducer — o StrictMode o roda duas
      // vezes e o selo sai dobrado. O ref dá o valor atual sem nenhum dos dois.
      const { selecao, origem } = aplicarCv(rascunhoRef.current, {
        stack: lido.cvProfile.stack,
        senioridade: lido.cvProfile.senioridade,
        // `job_titles` é o nome do backend; o catálogo da tela chama de cargos.
        cargos: lido.filtrosSugeridos.job_titles ?? [],
      })
      setRascunho(selecao)
      setOrigemCv((anterior) => {
        const junto: OrigemCv = { ...anterior }
        for (const [eixo, valores] of Object.entries(origem)) {
          const eixoTipado = eixo as keyof OrigemCv
          junto[eixoTipado] = new Set([...(anterior[eixoTipado] ?? []), ...valores])
        }
        return junto
      })
    },
    [],
  )

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
  const novasNaBusca = useMemo(
    () => vagas.filter((v) => !descartadas.has(v.url) && !vistas.has(v.url)).length,
    [vagas, vistas, descartadas],
  )

  return (
    <div className="flex flex-col gap-4">
      <BarraFiltros
        onAplicar={(s) => void buscar(s)}
        buscando={estado === 'buscando'}
        encontradas={vagas.length}
        jaBuscou={estado !== 'ocioso'}
        rascunho={rascunho}
        setRascunho={setRascunho}
        origemCv={origemCv}
        aoLimpar={() => setOrigemCv({})}
        aoDesmarcar={(eixo, valor) =>
          // **Desmarcar apaga a origem daquele valor.** O selo afirma "isto
          // veio do currículo, confira" — depois que a pessoa desmarcou e
          // marcou de novo, a escolha é dela, e o selo voltava afirmando o
          // contrário (QA, 25/08).
          setOrigemCv((anterior) => {
            const doEixo = anterior[eixo]
            if (!doEixo?.has(valor)) return anterior
            const restante = new Set(doEixo)
            restante.delete(valor)
            return { ...anterior, [eixo]: restante }
          })
        }
        cabecalho={<CaixaUploadCV ativa={leituraCvAtiva} onLeu={aoLerCv} />}
      />

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
        <p role="status" className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
    </div>
  )
}
