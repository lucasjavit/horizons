import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { BarraFiltros } from './BarraFiltros'
import { LinhaVaga } from './LinhaVaga'
import { buscarVagas } from '../../lib/busca-vagas'
import { opcoesDe, paraFiltrosApi } from './vaga-filtro'
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
 * As opções dos dropdowns saem das vagas já encontradas — antes da primeira
 * busca não há o que oferecer, e os controles ficam desabilitados dizendo isso.
 */
export function ListaVagas() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const abortar = useRef<AbortController | null>(null)

  const opcoes = useMemo(() => opcoesDe(vagas), [vagas])

  const buscar = useCallback(async (selecao: Selecao) => {
    // Uma busca por vez: sem isto, dois cliques em Filter escreveriam na mesma
    // lista e o resultado seria a mistura de duas consultas.
    abortar.current?.abort()
    const ctrl = new AbortController()
    abortar.current = ctrl

    setErro(null)
    setVagas([])
    setTotal(null)
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

  return (
    <div className="flex flex-col gap-4">
      <BarraFiltros
        opcoes={opcoes}
        onAplicar={(s) => void buscar(s)}
        buscando={estado === 'buscando'}
        encontradas={vagas.length}
      />

      {erro && (
        <p role="alert" className="text-sm" style={{ color: WARN_INK }}>
          {erro}
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
        <ul className="flex flex-col border-t" style={{ borderColor: 'var(--border)' }}>
          {vagas.map((vaga) => (
            <LinhaVaga key={vaga.id} vaga={vaga} />
          ))}
        </ul>
      )}

      {estado === 'ocioso' && <AindaNaoBuscou />}

      {estado === 'pronto' && vagas.length === 0 && !erro && (
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No jobs matched. Try fewer filters or a broader job title.
        </p>
      )}
    </div>
  )
}

/**
 * A primeira tela de todo mundo.
 *
 * Diz o que fazer, não o que está faltando. O texto anterior prometia uma busca
 * automática a cada 50 minutos — que não existe ainda — e chamava de "no jobs
 * yet" um estado que é, na verdade, "você ainda não buscou".
 */
function AindaNaoBuscou() {
  return (
    <section
      aria-labelledby="buscar-titulo"
      className="rounded-xl border p-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="buscar-titulo" className="text-lg font-semibold">
        Search for jobs
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Pick your filters above and hit <strong>Filter</strong>. We scan job
        boards and read each listing — results show up here as they come in,
        usually within a minute.
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        You can search with no filters at all, but a job title and a couple of
        skills give much better results.
      </p>
    </section>
  )
}
