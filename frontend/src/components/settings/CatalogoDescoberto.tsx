import { useState } from 'react'
import { ErrorState, LoadingState } from '../States'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import type { HostDescoberto } from '../../types/api'

/**
 * O que a busca aprendeu sobre o catálogo (JOB-37).
 *
 * **Agrupado por host, e ordenado por vagas rendidas.** O valor não é "mais
 * slugs de Greenhouse" — é descobrir um ATS que ainda não sabemos que existe.
 * Um ATS novo não vale uma empresa: vale todas as que ele hospeda. Por isso a
 * linha é o host, e a coluna que decide é quantas vagas ele já rendeu.
 *
 * Promover continua sendo decisão humana: esta tela não escreve em
 * `backend/data/ats/`. Quem decide roda `scripts/exportar-descobertas.py`.
 */
export function CatalogoDescoberto({ ligado }: { ligado: boolean }) {
  const fila = useAsync((signal) => api.descobertas(signal), [])
  const [verificando, setVerificando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const verificar = async () => {
    setErro(null)
    setVerificando(true)
    try {
      await api.verificarDescobertas()
      fila.reload()
    } catch (e) {
      setErro(errorMessage(e))
    } finally {
      setVerificando(false)
    }
  }

  return (
    <section
      aria-labelledby="descobertas-titulo"
      className="mt-9 rounded-lg border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="descobertas-titulo" className="text-lg font-semibold">
            What the search found
          </h2>
          <p
            className="mt-1 max-w-xl text-sm leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            Job boards the search ran into that the catalog does not list. A
            board hosting several companies is worth far more than one more
            company on a board we already query — it is a whole ATS we cannot
            search yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void verificar()}
          disabled={!ligado || verificando}
          className="min-h-[36px] shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {verificando ? 'Checking…' : 'Check now'}
        </button>
      </div>

      {!ligado && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Catalog learning is off. The search records nothing and the nightly
          check does not run. What is already listed below stays — turning the
          switch off never deletes anything.
        </p>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
          {erro}
        </p>
      )}

      {fila.loading && <LoadingState label="Loading…" />}
      {fila.error && <ErrorState message={fila.error} onRetry={fila.reload} />}

      {fila.data && fila.data.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Nothing found yet. Every search adds what it ran into; the check runs
          at 3am and counts how many jobs each board actually returns.
        </p>
      )}

      {fila.data && fila.data.length > 0 && (
        // Rola dentro do próprio contêiner: numa tela estreita a tabela não
        // pode empurrar a página inteira para o lado.
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">
              Job boards found by the search, by number of jobs returned
            </caption>
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                {COLUNAS.map(([rotulo, direita]) => (
                  <th
                    key={rotulo}
                    scope="col"
                    className={`py-2 pr-3 font-medium ${direita ? 'text-right' : 'text-left'}`}
                  >
                    {rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fila.data.map((h) => (
                <tr
                  key={h.host}
                  className="border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="py-2 pr-3">
                    <a
                      href={h.exemploUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium underline"
                      style={{ color: 'var(--accent-ink)' }}
                    >
                      {h.host}
                    </a>
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {h.ats ?? 'unknown ATS'}
                    </span>
                  </td>
                  {/* Tabular para as colunas de número alinharem na vertical.
                      **"Not checked" mostra em dash, não zero**: ausência de
                      informação e "rendeu nada" são coisas diferentes, e um
                      `0` faria alguém concluir que o board não vale nada. */}
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {h.checkedAt ? h.vagas : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{h.slugs}</td>
                  <td className="py-2" style={{ color: 'var(--text-muted)' }}>
                    {resumo(h)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className="mt-4 border-t pt-4 text-sm leading-relaxed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Nothing here is added to the catalog automatically — the catalog is
            hand-curated and lives in git. Run{' '}
            <code>scripts/exportar-descobertas.py</code> to promote the
            confirmed ones.
          </p>
        </div>
      )}
    </section>
  )
}

/** Os cabeçalhos, e se a coluna é numérica (alinhada à direita). */
const COLUNAS: ReadonlyArray<readonly [string, boolean]> = [
  ['Board', false],
  ['Jobs', true],
  ['Companies', true],
  ['Status', false],
]

/**
 * O estado do host em uma frase.
 *
 * **"Not checked yet" e "0 jobs" são coisas diferentes**, e a tabela mostra a
 * diferença: o primeiro é ausência de informação, o segundo é informação. Um
 * host nunca verificado mostrando "0" faria alguém concluir que não vale nada.
 */
function resumo(h: HostDescoberto): string {
  if (!h.checkedAt) return 'not checked yet'
  if (h.confirmadas > 0) return `${h.confirmadas} new board(s) returning jobs`
  if (h.desconhecidas > 0) return 'cannot query this board yet'
  // Vem antes de `mortas` e depois de `confirmadas`: é o desfecho mais comum e
  // o menos interessante — nada a promover, o catálogo já cobre.
  if (h.jaNoCatalogo > 0) return 'already in the catalog'
  if (h.mortas > 0) return 'board answered with no jobs'
  return 'checked'
}
