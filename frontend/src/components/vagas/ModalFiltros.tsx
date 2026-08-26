import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useSessao } from '../../lib/sessao'
import type { BuscaSalva, Facetas, OpcaoFaceta } from '../../types/api'
import { ChipFiltro, type EstadoChip } from './ChipFiltro'
import {
  CATEGORIAS,
  rotularValor,
  type CategoriaFiltro,
  type SecaoFiltro,
} from './modal-filtro'

/**
 * O modal "All filters" (JOB-41).
 *
 * Duas colunas: categorias à esquerda com badge de quantos filtros há em cada,
 * painel rolável à direita, e um rodapé fixo com `Clear all`, a contagem de
 * resultados e `Show jobs →`.
 *
 * **A contagem vem do servidor a cada mudança**, e não de contar as vagas na
 * tela: a lista traz 60 por busca, e a contagem fala de 16 mil. É a diferença
 * entre "quantas você está vendo" e "quantas existem" — só a segunda ajuda a
 * decidir se vale apertar mais o filtro.
 *
 * E é por isso que o número fica FORA do botão, ao contrário da referência:
 * "Show 14,976 jobs" prometeria 250 vezes o que a busca entrega. Ver a nota no
 * rodapé.
 */

/** O que a tela guarda: por campo do DTO, os valores incluídos e excluídos. */
export type SelecaoModal = Record<string, string[]>

export function ModalFiltros({
  aberto,
  selecaoInicial,
  onFechar,
  onAplicar,
}: {
  aberto: boolean
  selecaoInicial: SelecaoModal
  onFechar: () => void
  onAplicar: (selecao: SelecaoModal) => void
}) {
  // **Rascunho, e não a seleção viva.** Quem abre o modal, mexe e desiste tem
  // de sair como entrou — aplicar só acontece no botão do rodapé. É o mesmo
  // padrão da barra de filtros de hoje.
  const [rascunho, setRascunho] = useState<SelecaoModal>(selecaoInicial)
  const [categoriaAtiva, setCategoriaAtiva] = useState(CATEGORIAS[0].id)
  const [facetas, setFacetas] = useState<Facetas | null>(null)
  const [carregando, setCarregando] = useState(false)
  /** O servidor recusou a seleção (4xx). É bug nosso, e a tela precisa dizer. */
  const [erroDeContrato, setErroDeContrato] = useState(false)

  /**
   * As buscas guardadas (JOB-41).
   *
   * **Só para quem entrou.** Filtrar é anônimo, como ler uma aula (PLT-07);
   * guardar precisa de dono. Mostrar o botão a quem não entrou e devolver 401
   * no clique seria pedir login depois de a pessoa já ter montado o filtro.
   */
  const sessao = useSessao()
  const [salvas, setSalvas] = useState<BuscaSalva[]>([])
  const [salvando, setSalvando] = useState(false)
  const [nomeNovo, setNomeNovo] = useState('')
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null)
  const [buscaNaSecao, setBuscaNaSecao] = useState<Record<string, string>>({})

  const dialogo = useRef<HTMLDivElement>(null)
  const abriuCom = useRef<Element | null>(null)

  // Reabrir sempre parte do que está aplicado agora.
  useEffect(() => {
    if (aberto) setRascunho(selecaoInicial)
  }, [aberto, selecaoInicial])

  /**
   * As contagens, recarregadas a cada mudança do rascunho.
   *
   * Sem debounce de propósito: cada clique é uma decisão consciente, e o
   * `AbortController` já descarta a resposta que chegou tarde. Debounce aqui
   * faria o número "pensar" depois do clique, que é justamente o feedback que
   * o modal existe para dar.
   */
  useEffect(() => {
    if (!aberto) return
    const ac = new AbortController()
    setCarregando(true)
    api
      .facetas(rascunho, ac.signal)
      .then((f) => setFacetas(f))
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        // **4xx é defeito NOSSO, e não pode se disfarçar de motor fora.**
        //
        // O `.catch()` único tratava 400, 500 e freehire indisponível com a
        // mesma tela de "unavailable" — e foi isso que escondeu um erro de
        // contrato entre `modal-filtro.ts` e o `FiltrosDto` por trás de uma
        // mensagem que parecia comportamento projetado (QA, 26/08).
        const status = (e as { response?: { status?: number } })?.response?.status
        if (typeof status === 'number' && status >= 400 && status < 500) {
          console.error(
            '[filtros] o servidor recusou a seleção — provável divergência ' +
              'entre modal-filtro.ts e o FiltrosDto:',
            (e as { response?: { data?: unknown } })?.response?.data,
          )
          setErroDeContrato(true)
          return
        }
        setErroDeContrato(false)
        setFacetas(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) setCarregando(false)
      })
    return () => ac.abort()
  }, [aberto, rascunho])

  useEffect(() => {
    if (!aberto || !sessao) return
    const ac = new AbortController()
    api
      .buscasSalvas(ac.signal)
      .then(setSalvas)
      // Falhar aqui não atrapalha filtrar: a seção fica vazia e o resto
      // do modal continua inteiro.
      .catch(() => undefined)
    return () => ac.abort()
  }, [aberto, sessao])

  // Esc fecha, e o foco volta para quem abriu.
  useEffect(() => {
    if (!aberto) return
    abriuCom.current = document.activeElement
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    // **O foco fica preso dentro do diálogo.**
    //
    // `aria-modal` diz ao leitor de tela que o resto é inerte, mas **não
    // impede o Tab** de sair — medido pelo QA em 26/08: no 6º Tab o foco
    // pulava para um link atrás do overlay, e Shift+Tab saía na hora. Quem
    // navega por teclado perdia a posição e interagia com controles cobertos.
    const prender = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const caixa = dialogo.current
      if (!caixa) return
      const focaveis = caixa.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      // O ciclo é fechado nas duas pontas: do último com Tab volta ao
      // primeiro, e do primeiro com Shift+Tab vai ao último.
      if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primeiro.focus()
      } else if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault()
        ultimo.focus()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('keydown', prender)
    // O foco entra no diálogo, senão o leitor de tela continua na página.
    dialogo.current?.focus()
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('keydown', prender)
      if (abriuCom.current instanceof HTMLElement) abriuCom.current.focus()
    }
  }, [aberto, onFechar])

  const alternar = useCallback(
    (secao: SecaoFiltro, valor: string, proximo: EstadoChip) => {
      setRascunho((atual) => {
        const novo = { ...atual }
        const tirar = (campo: string) => {
          if (!campo) return
          const lista = (novo[campo] ?? []).filter((v) => v !== valor)
          if (lista.length > 0) novo[campo] = lista
          else delete novo[campo]
        }
        const por = (campo: string) => {
          if (!campo) return
          novo[campo] = [...(novo[campo] ?? []).filter((v) => v !== valor), valor]
        }
        // Sai dos dois antes de entrar em um: incluir e excluir o mesmo valor
        // ao mesmo tempo é um estado que a API atenderia devolvendo nada.
        tirar(secao.campo)
        if (secao.campoExcluir) tirar(secao.campoExcluir)
        if (proximo === 'incluir') por(secao.campo)
        if (proximo === 'excluir' && secao.campoExcluir) por(secao.campoExcluir)
        return novo
      })
    },
    [],
  )

  const estadoDe = useCallback(
    (secao: SecaoFiltro, valor: string): EstadoChip => {
      if ((rascunho[secao.campo] ?? []).includes(valor)) return 'incluir'
      if (secao.campoExcluir && (rascunho[secao.campoExcluir] ?? []).includes(valor)) {
        return 'excluir'
      }
      return 'off'
    },
    [rascunho],
  )

  /**
   * Quantos filtros ativos há em cada categoria — o badge da coluna esquerda.
   *
   * Conta valores, e não campos: escolher três países é "3", não "1".
   */
  const badges = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const cat of CATEGORIAS) {
      let n = 0
      for (const s of cat.secoes) {
        n += (rascunho[s.campo] ?? []).length
        if (s.campoExcluir) n += (rascunho[s.campoExcluir] ?? []).length
      }
      if (n > 0) mapa[cat.id] = n
    }
    return mapa
  }, [rascunho])

  /**
   * As categorias que têm dado agora.
   *
   * **Categoria sem faceta é ESCONDIDA, não desabilitada** (decisão de
   * 26/08). Sem o motor que fornece as contagens, marcar "English level" não
   * filtraria nada — e filtro que não filtra é pior que filtro ausente, que é
   * a regra que já tirou três eixos da barra em 19/08.
   *
   * Uma categoria fica se ao menos UMA seção dela tiver valores.
   */
  const visiveis = useMemo(() => {
    if (!facetas?.disponivel) return []
    const comValores = CATEGORIAS.filter((c) =>
      c.secoes.some((s) => (facetas.facetas[s.faceta] ?? []).length > 0),
    )
    // **Zero resultados não é "indisponível"** (QA, 26/08).
    //
    // Um filtro que não casa nada zera TODAS as facetas — e a tela lia isso
    // como motor fora do ar, escondendo o modal inteiro com a mensagem
    // errada. A pessoa via "unavailable" quando o certo era "sua combinação
    // não tem resultado", e perdia o acesso ao `Clear all` que resolveria.
    //
    // Com o serviço respondendo (`disponivel`), as categorias ficam mesmo
    // sem valores: os chips que a pessoa selecionou continuam lá, porque
    // `comSelecionados` os reinjeta, e ela consegue desmarcar.
    //
    // **Não há mensagem de "nenhum resultado", de propósito.** Chegou a haver
    // uma, e o QA notou que ela era inalcançável — esta linha devolve as
    // categorias justamente no caso em que a mensagem apareceria. Manter as
    // categorias é melhor que a frase: o `0 matches` do rodapé já diz o que
    // houve, e continuar mexendo nos filtros resolve, enquanto ler um texto
    // não (26/08).
    if (comValores.length === 0 && facetas.total === 0) return CATEGORIAS
    return comValores
  }, [facetas])

  // A categoria aberta pode ter sumido entre uma carga e outra.
  useEffect(() => {
    if (visiveis.length > 0 && !visiveis.some((c) => c.id === categoriaAtiva)) {
      setCategoriaAtiva(visiveis[0].id)
    }
  }, [visiveis, categoriaAtiva])

  if (!aberto) return null

  const categoria = visiveis.find((c) => c.id === categoriaAtiva) ?? visiveis[0]
  const grupos = ['ROLE', 'PAY & BENEFITS', 'REQUIREMENTS & ELIGIBILITY'] as const
  const temFiltro = Object.values(rascunho).some((l) => Array.isArray(l) && l.length > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6"
      style={{ background: 'rgb(0 0 0 / 0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-filtros-titulo"
        tabIndex={-1}
        className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <header
          className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 id="modal-filtros-titulo" className="text-lg font-semibold">
            All filters
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Close filters"
            className="h-9 w-9 rounded-md text-xl leading-none"
            style={{ color: 'var(--text-muted)' }}
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        {visiveis.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {carregando
                ? 'Loading filters…'
                : erroDeContrato
                  ? 'Something went wrong with this filter combination. Clearing the filters should fix it.'
                  : 'Advanced filters are unavailable right now. Search still works.'}
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            {/* Coluna esquerda: as categorias, agrupadas. */}
            <nav
              aria-label="Filter categories"
              className="hidden w-52 shrink-0 overflow-y-auto border-r py-3 sm:block"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* SAVED vem primeiro, como na referência — é atalho para o que
                  já se montou antes, e não mais uma categoria a montar. */}
              {sessao && salvas.length > 0 && (
                <div className="mb-4">
                  <p
                    className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    SAVED
                  </p>
                  {salvas.map((b) => (
                    <div key={b.id} className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => setRascunho(b.filtros as SelecaoModal)}
                        className="min-w-0 flex-1 truncate px-4 py-2 text-left text-sm"
                        style={{ color: 'var(--text)' }}
                        title={`Load "${b.nome}"`}
                      >
                        {b.nome}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void api
                            .apagarBuscaSalva(b.id)
                            .then(() => setSalvas((l) => l.filter((x) => x.id !== b.id)))
                            .catch(() => undefined)
                        }}
                        aria-label={`Delete saved filter ${b.nome}`}
                        className="h-8 w-8 shrink-0 rounded-md text-base leading-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span aria-hidden>×</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {grupos.map((g) => {
                const doGrupo = visiveis.filter((c) => c.grupo === g)
                if (doGrupo.length === 0) return null
                return (
                  <div key={g} className="mb-4">
                    <p
                      className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {g}
                    </p>
                    {doGrupo.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoriaAtiva(c.id)}
                        aria-current={c.id === categoria?.id ? 'true' : undefined}
                        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm"
                        style={{
                          background:
                            c.id === categoria?.id ? 'var(--surface-sunken)' : 'transparent',
                          color: 'var(--text)',
                        }}
                      >
                        <span>{c.rotulo}</span>
                        {badges[c.id] && (
                          <span
                            className="ml-2 rounded-full px-1.5 text-xs tabular-nums"
                            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
                          >
                            {badges[c.id]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )
              })}
            </nav>

            {/* Painel direito: as seções da categoria. */}
            <div className="min-w-0 flex-1 overflow-y-auto p-5">
              {/* No celular não há coluna: um select faz o papel dela. */}
              <div className="mb-4 sm:hidden">
                <label htmlFor="categoria-mobile" className="sr-only">
                  Filter category
                </label>
                <select
                  id="categoria-mobile"
                  value={categoria?.id ?? ''}
                  onChange={(e) => setCategoriaAtiva(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                >
                  {visiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.rotulo}
                      {badges[c.id] ? ` (${badges[c.id]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {categoria?.secoes.map((secao, iDaSecao) => {
                const opcoes = semRepetirNaCategoria(
                  comSelecionados(
                    facetas?.facetas[secao.faceta] ?? [],
                    rascunho,
                    secao,
                  ),
                  categoria,
                  iDaSecao,
                  facetas,
                )
                if (opcoes.length === 0) return null
                const termo = (buscaNaSecao[secao.faceta] ?? '').toLowerCase()
                const filtradas = termo
                  ? opcoes.filter(
                      (o) =>
                        o.valor.toLowerCase().includes(termo) ||
                        rotularValor(secao.faceta, o.valor).toLowerCase().includes(termo),
                    )
                  : opcoes

                return (
                  <section key={secao.faceta} className="mb-7">
                    <h3 className="mb-2 text-sm font-semibold">{secao.titulo}</h3>

                    {secao.buscavel && (
                      <>
                        <label htmlFor={`busca-${secao.faceta}`} className="sr-only">
                          Search {secao.titulo.toLowerCase()}
                        </label>
                        <input
                          id={`busca-${secao.faceta}`}
                          type="search"
                          value={buscaNaSecao[secao.faceta] ?? ''}
                          onChange={(e) =>
                            setBuscaNaSecao((b) => ({
                              ...b,
                              [secao.faceta]: e.target.value,
                            }))
                          }
                          placeholder={`Search ${secao.titulo.toLowerCase()}…`}
                          className="mb-3 w-full rounded-md border px-3 py-2 text-sm"
                          style={{
                            borderColor: 'var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text)',
                          }}
                        />
                      </>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {filtradas.map((o) => (
                        <ChipFiltro
                          key={o.valor}
                          rotulo={rotularValor(secao.faceta, o.valor)}
                          total={o.total}
                          estado={estadoDe(secao, o.valor)}
                          onAlternar={(p) => alternar(secao, o.valor, p)}
                        />
                      ))}
                      {filtradas.length === 0 && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          No match.
                        </p>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}

        <footer
          className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setRascunho({})}
              className="text-sm underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear all
            </button>

            {/* Salvar só aparece com sessão E com filtro montado: guardar uma
                busca vazia não guarda nada. */}
            {sessao && temFiltro && !salvando && (
              <button
                type="button"
                onClick={() => {
                  setSalvando(true)
                  setErroAoSalvar(null)
                }}
                className="text-sm underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Save this filter
              </button>
            )}

            {sessao && salvando && (
              <form
                className="flex min-w-0 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const nome = nomeNovo.trim()
                  if (!nome) return
                  void api
                    .salvarBusca({ nome, filtros: rascunho })
                    .then((nova) => {
                      setSalvas((l) => [nova, ...l])
                      setSalvando(false)
                      setNomeNovo('')
                    })
                    .catch(() =>
                      setErroAoSalvar('Could not save this filter. Try again.'),
                    )
                }}
              >
                <label htmlFor="nome-da-busca" className="sr-only">
                  Name for this filter
                </label>
                <input
                  id="nome-da-busca"
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value)}
                  placeholder="Name this filter"
                  maxLength={80}
                  aria-invalid={erroAoSalvar ? true : undefined}
                  aria-describedby={erroAoSalvar ? 'erro-salvar' : undefined}
                  className="w-40 rounded-md border px-2 py-1.5 text-sm"
                  style={{
                    borderColor: erroAoSalvar ? 'var(--accent-ink)' : 'var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
                <button
                  type="submit"
                  className="rounded-md border px-3 py-1.5 text-sm"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Save
                </button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/*
              **O total fica AO LADO do botão, e não dentro dele.**

              A referência escreve "Show 699 jobs" no botão, e ali isso é
              verdade: a busca deles pagina o catálogo inteiro. A nossa traz
              **60 por busca** (`LIMITE` em `busca-freehire.service.ts`), então
              um botão dizendo "Show 14,976 jobs" prometeria 250 vezes o que
              entrega — e a pessoa contaria as vagas na tela para descobrir.

              Separar resolve sem perder o número: o texto informa quantas
              existem ("14,976 matches"), o botão diz o que vai acontecer
              ("Show jobs"). São duas afirmações verdadeiras, no lugar de uma
              falsa.
            */}
            {facetas?.total != null && (
              <p className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {facetas.total.toLocaleString('en-US')}{' '}
                {facetas.total === 1 ? 'match' : 'matches'}
              </p>
            )}
            {erroAoSalvar && (
              <p id="erro-salvar" role="alert" className="text-sm" style={{ color: 'var(--accent-ink)' }}>
                {erroAoSalvar}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                onAplicar(rascunho)
                onFechar()
              }}
              className="rounded-md px-5 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
            >
              Show jobs <span aria-hidden>→</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}


/**
 * As opções da faceta, mais os valores que a pessoa já escolheu.
 *
 * **Sem isto, excluir um chip o faz sumir** (QA, 26/08): a API não devolve na
 * faceta o valor que foi excluído — ele deixou de ter resultado, por
 * definição. Como os chips saíam só da faceta, o chip desaparecia e o filtro
 * ficava ativo, invisível e irreversível: o badge dizia "Skills 1" e não havia
 * como desfazer sem `Clear all`.
 *
 * O valor reinjetado entra com `total: null` — não sabemos quantas vagas ele
 * teria, e inventar um número seria pior que não mostrar nenhum.
 */
function comSelecionados(
  daFaceta: OpcaoFaceta[],
  rascunho: SelecaoModal,
  secao: SecaoFiltro,
): OpcaoFaceta[] {
  const escolhidos = [
    ...(rascunho[secao.campo] ?? []),
    ...(secao.campoExcluir ? (rascunho[secao.campoExcluir] ?? []) : []),
  ]
  if (escolhidos.length === 0) return daFaceta
  const presentes = new Set(daFaceta.map((o) => o.valor))
  const faltando = escolhidos
    .filter((v) => !presentes.has(v))
    .map((valor) => ({ valor, total: null }))
  // Os reinjetados vão na frente: são o que a pessoa mexeu, e procurá-los no
  // fim de uma lista de 40 seria trabalho que ela não pediu.
  return [...faltando, ...daFaceta]
}


/**
 * Tira da seção os valores que uma seção ANTERIOR da mesma categoria já mostra.
 *
 * O QA achou `Devops` duas vezes na categoria Role — em `role` e em `category`
 * (26/08). Não era erro de rótulo: medido, `roles=devops` e
 * `categories=devops` devolvem **exatamente 45.879** cada. É o mesmo filtro por
 * dois eixos, e dois chips idênticos com a mesma contagem só fazem a pessoa
 * duvidar de qual clicar.
 *
 * Some da segunda, e não da primeira: `role` é o eixo mais específico e vem
 * antes. E não se remove a seção inteira — a sobreposição é parcial (5 de 40
 * valores), então `category` ainda carrega o que só ela tem.
 */
function semRepetirNaCategoria(
  opcoes: OpcaoFaceta[],
  categoria: CategoriaFiltro | undefined,
  iDaSecao: number,
  facetas: Facetas | null,
): OpcaoFaceta[] {
  if (!categoria || iDaSecao === 0 || !facetas) return opcoes
  const jaMostrados = new Set<string>()
  for (let i = 0; i < iDaSecao; i++) {
    for (const o of facetas.facetas[categoria.secoes[i].faceta] ?? []) {
      jaMostrados.add(o.valor)
    }
  }
  return opcoes.filter((o) => !jaMostrados.has(o.valor))
}
