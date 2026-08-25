import { Link } from 'react-router-dom'
import { ProgressBar } from '../components/ProgressBar'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useSessao } from '../lib/sessao'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function TracksPage() {
  const usuario = useSessao()
  const { data, loading, error, reload } = useAsync(
    (signal) => api.listTracks(signal),
    [],
  )
  useDocumentTitle('Tracks')

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {/* "Suas" so depois de entrar: sem sessao nao ha progresso guardado,
              e o possessivo prometeria algo que a pagina nao entrega. */}
          {usuario ? 'Your tracks' : 'Tracks'}
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          {usuario
            ? 'Structured study, at your own pace.'
            : 'Structured study, at your own pace. Sign in with Google to save your progress.'}
        </p>
      </header>

      {loading && <LoadingState label="Loading tracks…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState message="No tracks published yet." />
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
                {/* Titulo e descricao da trilha sao conteudo autoral em
                    portugues; a moldura em volta e em ingles. */}
                <h2 lang="pt-BR" className="text-lg font-semibold tracking-tight">
                  {track.title}
                </h2>
                <p
                  lang="pt-BR"
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
