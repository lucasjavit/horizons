import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ProgressBar } from '../components/ProgressBar'
import { ErrorState, LoadingState } from '../components/States'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { TrackDetail } from '../types/api'

export function TrackPage() {
  const { trackSlug = '' } = useParams()
  const { data, loading, error, reload, setData } = useAsync(
    (signal) => api.getTrack(trackSlug, signal),
    [trackSlug],
  )

  useDocumentTitle(data?.title ?? null)

  const [abertos, setAbertos] = useState<Set<string> | null>(null)
  const [soPendentes, setSoPendentes] = useState(false)
  const [erroToggle, setErroToggle] = useState<string | null>(null)

  // O breadcrumb da aula linka /t/:slug#modulo — o módulo indicado abre e
  // a página rola até ele.
  const { hash } = useLocation()
  const moduloAlvo = hash ? decodeURIComponent(hash.slice(1)) : null

  // Antes de qualquer clique, abre o módulo vindo do hash; na falta dele, o
  // primeiro com aula pendente.
  const expandidos = useMemo(() => {
    if (abertos) return abertos
    if (!data) return new Set<string>()
    const alvo = moduloAlvo
      ? data.modules.find((mod) => mod.slug === moduloAlvo)
      : undefined
    if (alvo) return new Set([alvo.id])
    const primeiro = data.modules.find((mod) =>
      mod.lessons.some((lesson) => !lesson.completed),
    )
    return new Set(primeiro ? [primeiro.id] : [])
  }, [abertos, data, moduloAlvo])

  useEffect(() => {
    if (!moduloAlvo || !data) return
    document
      .getElementById(`mod-${moduloAlvo}`)
      ?.scrollIntoView({ block: 'start' })
  }, [moduloAlvo, data])

  const alternarModulo = (id: string) => {
    const proximo = new Set(expandidos)
    if (proximo.has(id)) proximo.delete(id)
    else proximo.add(id)
    setAbertos(proximo)
  }

  /** Marca/desmarca com atualização otimista e rollback se a API falhar. */
  const alternarAula = async (lessonId: string, completed: boolean) => {
    if (!data) return
    const anterior = data
    setErroToggle(null)
    setData(aplicarConclusao(data, lessonId, completed))

    try {
      await api.setCompleted(lessonId, completed)
    } catch (err) {
      setData(anterior)
      setErroToggle(errorMessage(err))
    }
  }

  if (loading) return <LoadingState label="Carregando trilha…" />
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )
  if (!data) return null

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <Link
        to="/"
        className="text-sm font-medium"
        style={{ color: 'var(--accent-ink)' }}
      >
        ← Trilhas
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {data.icon && <span className="mr-2">{data.icon}</span>}
          {data.title}
        </h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {data.description}
        </p>
        <div className="mt-5">
          <ProgressBar
            completed={data.completedLessons}
            total={data.totalLessons}
            showLabel
          />
        </div>
      </header>

      {data.nextLesson && (
        <Link
          to={`/t/${data.slug}/${data.nextLesson.lessonSlug}`}
          className="mb-6 flex items-center justify-between gap-4 rounded-xl p-4"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          <span className="min-w-0">
            <span className="block text-xs uppercase tracking-widest opacity-80">
              Continue de onde parou
            </span>
            <span className="mt-0.5 block truncate font-semibold">
              {data.nextLesson.title}
            </span>
          </span>
          <span aria-hidden className="text-lg">
            →
          </span>
        </Link>
      )}

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={soPendentes}
          onChange={(e) => setSoPendentes(e.target.checked)}
          className="h-4 w-4 accent-[var(--brand)]"
        />
        Mostrar só pendentes
      </label>

      {erroToggle && (
        <p
          className="mb-4 rounded-md px-3 py-2 text-sm"
          style={{ background: 'var(--surface-sunken)', color: 'var(--text-muted)' }}
          role="alert"
        >
          Não foi possível salvar: {erroToggle}
        </p>
      )}

      <div className="space-y-3">
        {data.modules.map((mod, i) => {
          const aulas = soPendentes
            ? mod.lessons.filter((lesson) => !lesson.completed)
            : mod.lessons
          if (soPendentes && aulas.length === 0) return null

          const concluidas = mod.lessons.filter((l) => l.completed).length
          const aberto = expandidos.has(mod.id)

          return (
            <section
              key={mod.id}
              id={`mod-${mod.slug}`}
              className="scroll-mt-20 overflow-hidden rounded-xl border"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-raised)',
              }}
            >
              <button
                type="button"
                onClick={() => alternarModulo(mod.id)}
                aria-expanded={aberto}
                className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background:
                      concluidas === mod.lessons.length
                        ? 'var(--accent)'
                        : 'var(--surface-sunken)',
                    color:
                      concluidas === mod.lessons.length
                        ? 'var(--accent-text)'
                        : 'var(--text-muted)',
                  }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold tracking-tight">
                    {mod.title}
                  </span>
                  <span
                    className="mt-0.5 block text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {concluidas}/{mod.lessons.length} concluídas
                  </span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-xs transition-transform"
                  style={{
                    color: 'var(--text-muted)',
                    transform: aberto ? 'rotate(90deg)' : 'none',
                  }}
                >
                  ▶
                </span>
              </button>

              {aberto && (
                <div
                  className="border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <p
                    className="px-4 py-3 text-sm leading-relaxed sm:px-5"
                    style={{
                      color: 'var(--text-muted)',
                      background: 'var(--surface-sunken)',
                    }}
                  >
                    {mod.goal}
                  </p>
                  <ul>
                    {aulas.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-start gap-3 border-t px-4 py-3 sm:px-5"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <input
                          type="checkbox"
                          checked={lesson.completed}
                          onChange={(e) =>
                            void alternarAula(lesson.id, e.target.checked)
                          }
                          aria-label={`Marcar "${lesson.title}" como concluída`}
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/t/${data.slug}/${lesson.slug}`}
                            className="font-medium hover:underline"
                            style={{
                              color: lesson.completed
                                ? 'var(--text-muted)'
                                : 'var(--text)',
                            }}
                          >
                            {lesson.title}
                          </Link>
                          {!lesson.hasContent && (
                            <span
                              className="ml-2 rounded px-1.5 py-0.5 align-middle text-[0.65rem] font-semibold uppercase tracking-wide"
                              style={{
                                background: 'var(--surface-sunken)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              em breve
                            </span>
                          )}
                          {lesson.summary && (
                            <p
                              className="mt-0.5 text-sm leading-snug"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {lesson.summary}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}

/** Aplica a conclusão de uma aula na árvore, recalculando os contadores. */
function aplicarConclusao(
  track: TrackDetail,
  lessonId: string,
  completed: boolean,
): TrackDetail {
  const modules = track.modules.map((mod) => ({
    ...mod,
    lessons: mod.lessons.map((lesson) =>
      lesson.id === lessonId ? { ...lesson, completed } : lesson,
    ),
  }))

  const todas = modules.flatMap((mod) => mod.lessons)
  const proxima = todas.find((lesson) => !lesson.completed)
  const moduloDaProxima = proxima
    ? modules.find((mod) => mod.lessons.some((l) => l.id === proxima.id))
    : undefined

  return {
    ...track,
    modules,
    completedLessons: todas.filter((lesson) => lesson.completed).length,
    nextLesson:
      proxima && moduloDaProxima
        ? {
            moduleSlug: moduloDaProxima.slug,
            lessonSlug: proxima.slug,
            title: proxima.title,
          }
        : null,
  }
}
