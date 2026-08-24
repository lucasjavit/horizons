import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { WARN_INK } from '../blocks/BlockRenderer'
import { BarraFiltros } from './BarraFiltros'
import { LinhaVaga } from './LinhaVaga'
import { POR_PAGINA, Paginacao } from './Paginacao'
import { api, ehSemSessao } from '../../lib/api'
import { buscarVagas } from '../../lib/busca-vagas'
import { paraFiltrosApi } from './vaga-filtro'
import type { Selecao } from './vaga-filtro'
import type { Vaga } from '../../types/api'

type Estado = 'ocioso' | 'buscando' | 'pronto'


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
