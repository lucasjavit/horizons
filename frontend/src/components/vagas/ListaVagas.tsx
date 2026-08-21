import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { BarraFiltros } from './BarraFiltros'
import { LinhaVaga } from './LinhaVaga'
import { api, ehSemSessao } from '../../lib/api'
import { buscarVagas } from '../../lib/busca-vagas'
import { paraFiltrosApi } from './vaga-filtro'
import type { Selecao } from './vaga-filtro'
import type { Vaga } from '../../types/api'

type Estado = 'ocioso' | 'buscando' | 'pronto'

/**
 * Quantas vagas por página.
 *
 * 25 é o que cabe numa rolada de tela sem virar rolagem infinita. A busca
 * devolve de 40 a 220 dependendo dos filtros — mostrar tudo de uma vez faz a
 * pessoa perder o lugar e desistir antes da metade.
 */
const POR_PAGINA = 25

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
  const [mostrandoSalvas, setMostrandoSalvas] = useState(false)
  const abortar = useRef<AbortController | null>(null)

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
    try {
      if (salvar) await api.salvarVaga(vaga)
      else await api.removerSalva(vaga.url)
    } catch {
      // Rollback: a estrela não pode dizer "salvo" quando não salvou.
      setSalvas((atual) => {
        const proximo = new Set(atual ?? [])
        if (salvar) proximo.delete(vaga.url)
        else proximo.add(vaga.url)
        return proximo
      })
      setAvisoSalva(`Could not ${salvar ? 'save' : 'remove'} ${vaga.title}.`)
    }
  }, [])

  const paginas = Math.max(1, Math.ceil(vagas.length / POR_PAGINA))
  // A página nunca passa do fim: se a lista encolheu enquanto a busca
  // streamava, `pagina` poderia apontar para o vazio.
  const atual = Math.min(pagina, paginas)
  const visiveis = useMemo(
    () => vagas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA),
    [vagas, atual],
  )

  return (
    <div className="flex flex-col gap-4">
      {salvas && salvas.size > 0 && (
        // As salvas ficam no TOPO, e não num painel lateral como o card
        // previa: a tela de vagas já tem oito filtros à esquerda, e uma
        // terceira coluna espremeria a lista — que é o conteúdo.
        <PainelSalvas
          quantas={salvas.size}
          onAbrir={() => setMostrandoSalvas((v) => !v)}
          aberto={mostrandoSalvas}
          onAlternarSalva={alternarSalva}
        />
      )}

      <BarraFiltros
        onAplicar={(s) => void buscar(s)}
        buscando={estado === 'buscando'}
        encontradas={vagas.length}
        jaBuscou={estado !== 'ocioso'}
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

      {estado === 'buscando' && (
        // `role="status"` e não `alert`: é progresso, não urgência — o leitor
        // de tela anuncia sem interromper o que a pessoa está fazendo.
        <p role="status" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {total === null
            ? 'Searching job boards…'
            : `Reading ${total} listings — ${vagas.length} done`}
        </p>
      )}

      {vagas.length > 0 && (
        <>
          <ul className="flex flex-col border-t" style={{ borderColor: 'var(--border)' }}>
            {visiveis.map((vaga) => (
              <LinhaVaga
                key={vaga.id}
                vaga={vaga}
                salva={salvas?.has(vaga.url)}
                // Sem a lista carregada não há estrela: melhor ausente que
                // mostrando um estado que pode estar errado.
                onAlternarSalva={salvas ? alternarSalva : undefined}
              />
            ))}
          </ul>

          {paginas > 1 && (
            <Paginacao
              atual={atual}
              paginas={paginas}
              total={vagas.length}
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

      {estado === 'pronto' && vagas.length === 0 && !erro && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No jobs matched. Try fewer filters or a broader job title.
        </p>
      )}
    </div>
  )
}

/**
 * "Minhas vagas" — o que a pessoa guardou.
 *
 * Recolhido por padrão e com a contagem visível: é o mesmo gesto do histórico
 * da invoice, e pela mesma razão — dizer "o que você guardou está aqui" sem
 * exigir um clique às cegas nem roubar espaço da lista.
 */
function PainelSalvas({
  quantas,
  aberto,
  onAbrir,
  onAlternarSalva,
}: {
  quantas: number
  aberto: boolean
  onAbrir: () => void
  onAlternarSalva: (vaga: Vaga, salvar: boolean) => void
}) {
  const [lista, setLista] = useState<Vaga[] | null>(null)

  // Só busca quando abre: a contagem já vem do estado da lista principal, e
  // carregar o conteúdo de um painel fechado é rede à toa.
  useEffect(() => {
    if (!aberto || lista) return
    const ctrl = new AbortController()
    api
      .listarSalvas(ctrl.signal)
      .then(setLista)
      .catch(() => {
        if (!ctrl.signal.aborted) setLista([])
      })
    return () => ctrl.abort()
  }, [aberto, lista])

  return (
    <section
      className="rounded-lg border"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={aberto}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium"
        style={{ color: 'var(--text)' }}
      >
        <span>
          Saved jobs{' '}
          <span
            className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-5"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {quantas}
          </span>
        </span>
        <span aria-hidden style={{ color: 'var(--text-muted)' }}>
          {aberto ? '▴' : '▾'}
        </span>
      </button>

      {aberto && (
        <div className="border-t px-4" style={{ borderColor: 'var(--border)' }}>
          {lista === null ? (
            <p className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading…
            </p>
          ) : (
            <ul className="flex flex-col">
              {lista.map((vaga) => (
                <LinhaVaga
                  key={vaga.id}
                  vaga={vaga}
                  salva
                  onAlternarSalva={(v, s) => {
                    onAlternarSalva(v, s)
                    // Some da lista na hora: continuar exibindo uma vaga que a
                    // pessoa acabou de remover parece que o clique não pegou.
                    setLista((atual) => (atual ?? []).filter((x) => x.url !== v.url))
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * A navegação entre páginas.
 *
 * `nav` com `aria-label` porque é navegação de verdade, e o leitor de tela
 * precisa poder pular para cá. A página atual leva `aria-current="page"` — sem
 * isso, quem não vê a cor não sabe onde está.
 */
function Paginacao({
  atual,
  paginas,
  total,
  onIr,
}: {
  atual: number
  paginas: number
  total: number
  onIr: (p: number) => void
}) {
  // Uma janela de até 5 números em volta da atual. Com 9 páginas, listar
  // todas ainda cabe; com 40, viraria uma régua ilegível.
  const inicio = Math.max(1, Math.min(atual - 2, paginas - 4))
  const fim = Math.min(paginas, inicio + 4)
  const numeros = []
  for (let i = inicio; i <= fim; i++) numeros.push(i)

  const botao =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm disabled:opacity-40'

  return (
    <nav
      aria-label="Job list pages"
      className="flex flex-wrap items-center justify-center gap-2 py-4"
    >
      <button
        type="button"
        onClick={() => onIr(atual - 1)}
        disabled={atual === 1}
        className={botao}
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        Previous
      </button>

      {numeros.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onIr(n)}
          aria-current={n === atual ? 'page' : undefined}
          className={botao}
          style={{
            borderColor: n === atual ? 'var(--brand)' : 'var(--border)',
            background: n === atual ? 'var(--brand)' : 'var(--surface)',
            color: n === atual ? 'var(--brand-text)' : 'var(--text)',
            fontWeight: n === atual ? 600 : 400,
          }}
        >
          {n}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onIr(atual + 1)}
        disabled={atual === paginas}
        className={botao}
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        Next
      </button>

      <span className="ml-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        {total} jobs
      </span>
    </nav>
  )
}
