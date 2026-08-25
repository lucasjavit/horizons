import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from './ProgressBar'
import { api } from '../lib/api'
import type { LessonSearchHit, TrackDetail } from '../types/api'

interface LessonSidebarProps {
  track: TrackDetail
  aulaAtual: string
  /** Fecha o painel no mobile ao navegar. */
  onNavigate?: () => void
}

/** Remove acento e caixa: buscar "quorum" precisa achar "quórum". */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/** Navegação da trilha exibida ao lado da aula. */
export function LessonSidebar({
  track,
  aulaAtual,
  onNavigate,
}: LessonSidebarProps) {
  const [busca, setBusca] = useState('')
  const buscaAdiada = useDeferredValue(busca)
  const campo = useRef<HTMLInputElement>(null)

  // Filtra por título e resumo — os dois já vêm no GET /tracks/:slug, então
  // não há chamada extra à API.
  const modulos = useMemo(() => {
    const termo = normalizar(buscaAdiada.trim())
    if (!termo) return track.modules
    return track.modules
      .map((mod) => ({
        ...mod,
        lessons: mod.lessons.filter((l) =>
          normalizar(`${l.title} ${l.summary ?? ''}`).includes(termo),
        ),
      }))
      .filter((mod) => mod.lessons.length > 0)
  }, [track.modules, buscaAdiada])

  const achados = modulos.reduce((n, m) => n + m.lessons.length, 0)

  // Termos que só aparecem no corpo da aula (o clássico "quórum") não são
  // achados pelo filtro local, que só enxerga título e resumo. Nesse caso a
  // API procura no conteúdo.
  const [noCorpo, setNoCorpo] = useState<LessonSearchHit[]>([])
  const termoLimpo = buscaAdiada.trim()

  useEffect(() => {
    if (termoLimpo.length < 2 || achados > 0) {
      setNoCorpo([])
      return
    }
    const ctrl = new AbortController()
    api
      .searchLessons(track.slug, termoLimpo, ctrl.signal)
      .then(setNoCorpo)
      .catch(() => setNoCorpo([]))
    return () => ctrl.abort()
  }, [termoLimpo, achados, track.slug])

  return (
    <nav aria-label="Track lessons" className="text-sm">
      {/* Nomes de trilha, modulo e aula sao conteudo em portugues dentro de
          uma interface em ingles — daí o `lang` em cada um deles. */}
      <Link
        to={`/t/${track.slug}`}
        onClick={onNavigate}
        lang="pt-BR"
        className="block py-1 font-semibold tracking-tight hover:underline"
      >
        {track.icon && <span className="mr-1.5">{track.icon}</span>}
        {track.title}
      </Link>

      <div className="mt-3 mb-4">
        <ProgressBar
          completed={track.completedLessons}
          total={track.totalLessons}
          showLabel
        />
      </div>

      <div className="mb-5">
        <label htmlFor="busca-aulas" className="sr-only">
          Search lessons
        </label>
        <input
          id="busca-aulas"
          ref={campo}
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setBusca('')
              campo.current?.blur()
            }
          }}
          placeholder="Search lessons…    /"
          className="w-full rounded-md border px-2.5 py-1.5 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
          }}
        />
        {busca.trim() !== '' && (
          <p
            aria-live="polite"
            className="mt-1.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {achados > 0
              ? `${achados} ${achados === 1 ? 'lesson' : 'lessons'}`
              : noCorpo.length > 0
                ? `${noCorpo.length} ${noCorpo.length === 1 ? 'lesson mentions' : 'lessons mention'} the term`
                : 'No lessons found.'}
          </p>
        )}
      </div>

      {achados === 0 && noCorpo.length > 0 && (
        <ul className="mb-5 space-y-px">
          {noCorpo.map((hit) => (
            <li key={hit.slug}>
              <Link
                to={`/t/${track.slug}/${hit.slug}`}
                onClick={onNavigate}
                className="block rounded-md px-2 py-1.5 leading-snug"
              >
                <span lang="pt-BR" className="block">{hit.title}</span>
                <span
                  lang="pt-BR"
                  className="block text-[0.7rem] uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {hit.moduleTitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-5">
        {modulos.map((mod) => (
          <div key={mod.id}>
            <p
              lang="pt-BR"
              className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              {mod.title}
            </p>
            <ul className="space-y-px">
              {mod.lessons.map((lesson) => {
                const atual = lesson.slug === aulaAtual
                return (
                  <li key={lesson.id}>
                    <Link
                      to={`/t/${track.slug}/${lesson.slug}`}
                      onClick={onNavigate}
                      aria-current={atual ? 'page' : undefined}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 leading-snug"
                      style={{
                        background: atual ? 'var(--surface-sunken)' : undefined,
                        color: atual
                          ? 'var(--text)'
                          : lesson.completed
                            ? 'var(--text-muted)'
                            : 'var(--text)',
                        fontWeight: atual ? 600 : 400,
                      }}
                    >
                      <span
                        aria-hidden
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background: lesson.completed
                            ? 'var(--accent)'
                            : 'var(--border)',
                        }}
                      />
                      <span lang="pt-BR" className="min-w-0">{lesson.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* O vocabulário visual (ponto dourado, ponto cinza) era decifrável só
          por dedução. A legenda declara, e de quebra documenta os atalhos. */}
      <div
        className="mt-6 border-t pt-4 text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <dl className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            <dt className="sr-only">Gold dot</dt>
            <dd>Lesson completed</dd>
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: 'var(--border)' }}
            />
            <dt className="sr-only">Grey dot</dt>
            <dd>Not completed yet</dd>
          </div>
        </dl>
        <p className="mt-3 leading-relaxed">
          <Tecla>J</Tecla> next · <Tecla>K</Tecla> previous ·{' '}
          <Tecla>C</Tecla> complete · <Tecla>/</Tecla> search
        </p>
      </div>
    </nav>
  )
}

function Tecla({ children }: { children: string }) {
  return (
    <kbd
      className="rounded border px-1 font-mono text-[0.7rem]"
      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      {children}
    </kbd>
  )
}
