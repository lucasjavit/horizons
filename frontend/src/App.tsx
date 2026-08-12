import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { LessonPage } from './pages/LessonPage'
import { TrackPage } from './pages/TrackPage'
import { TracksPage } from './pages/TracksPage'

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link
        to="/"
        className="mt-4 inline-block font-medium underline"
        style={{ color: 'var(--accent-ink)' }}
      >
        Voltar para as trilhas
      </Link>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-dvh">
        {/* Primeiro elemento focável da página: sem ele, a sidebar da aula
            impõe 78 tabulações antes do conteúdo. Só aparece com foco. */}
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:px-4 focus:py-2 focus:font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          Pular para o conteúdo
        </a>
        <header
          className="sticky top-0 z-10 border-b backdrop-blur"
          style={{
            borderColor: 'var(--border)',
            background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6">
            <Link to="/" className="font-bold tracking-tight">
              <span style={{ color: 'var(--brand)' }}>Horizons</span>
            </Link>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<TracksPage />} />
          <Route path="/t/:trackSlug" element={<TrackPage />} />
          <Route path="/t/:trackSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
