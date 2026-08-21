import { useCallback, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { LinhaVaga } from '../components/vagas/LinhaVaga'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Vaga } from '../types/api'

/**
 * As vagas que a pessoa guardou.
 *
 * Aba própria, e não um painel na tela de busca: são momentos de uso
 * diferentes. Buscar é explorar; reler o que se guardou é preparar a
 * candidatura — e essa segunda coisa merece a tela inteira, sem oito filtros
 * disputando espaço.
 *
 * **O que se lê aqui é o retrato do dia em que ela salvou**, não o anúncio ao
 * vivo. A vaga sai do ar em semanas; o snapshot é o que sobrevive, com o
 * trecho de salário e elegibilidade que a torna conferível (JOB-09).
 */
export function SalvasPage() {
  useDocumentTitle('Saved jobs')
  const { data, loading, error, reload } = useAsync(
    (signal) => api.listarSalvas(signal),
    [],
  )
  /** Removidas nesta sessão, para a lista responder sem esperar a rede. */
  const [removidas, setRemovidas] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState('')

  const remover = useCallback(async (vaga: Vaga) => {
    setRemovidas((s) => new Set(s).add(vaga.url))
    setAviso(`${vaga.title} removed from saved.`)
    try {
      await api.removerSalva(vaga.url)
    } catch {
      // Rollback: a vaga volta se a remoção falhou. Sumir da tela e continuar
      // no banco é o pior dos dois mundos — ela pensa que removeu.
      setRemovidas((s) => {
        const p = new Set(s)
        p.delete(vaga.url)
        return p
      })
      setAviso(`Could not remove ${vaga.title}.`)
    }
  }, [])

  const visiveis = (data ?? []).filter((v) => !removidas.has(v.url))

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Saved jobs
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        These stay here for good — even after the original posting goes offline.
      </p>

      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {loading && <LoadingState label="Loading saved jobs…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && visiveis.length === 0 && !loading && (
        <EmptyState message="Nothing saved yet. Star a job on the Jobs tab and it shows up here." />
      )}

      {visiveis.length > 0 && (
        <>
          <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            {visiveis.length} {visiveis.length === 1 ? 'job' : 'jobs'}
          </p>
          <ul
            className="mt-2 flex flex-col border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            {visiveis.map((vaga) => (
              <LinhaVaga
                key={vaga.id}
                vaga={vaga}
                salva
                onAlternarSalva={(v) => void remover(v)}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
