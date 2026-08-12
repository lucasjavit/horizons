import { Link } from 'react-router-dom'
import { ProgressBar } from '../components/ProgressBar'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function TracksPage() {
  const { data, loading, error, reload } = useAsync(
    (signal) => api.listTracks(signal),
    [],
  )
  useDocumentTitle('Trilhas')

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Suas trilhas
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          Estudo estruturado, no seu ritmo.
        </p>
      </header>

      {loading && <LoadingState label="Carregando trilhas…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState message="Nenhuma trilha publicada ainda." />
      )}

      <div className="space-y-4">
        {data?.map((track) => (
          <Link
            key={track.id}
            to={`/t/${track.slug}`}
            className="block rounded-xl border p-5 transition-colors hover:border-[var(--brand)] sm:p-6"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-raised)',
            }}
          >
            <div className="flex items-start gap-4">
              {track.icon && (
                <span className="text-3xl leading-none" aria-hidden>
                  {track.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  {track.title}
                </h2>
                <p
                  className="mt-1 text-sm leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {track.description}
                </p>
                <div className="mt-4">
                  <ProgressBar
                    completed={track.completedLessons}
                    total={track.totalLessons}
                    showLabel
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
