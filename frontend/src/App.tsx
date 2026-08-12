import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { InvoicePage } from './pages/InvoicePage'
// QUADRO (temporario) — remover esta linha junto com a pagina
import { QuadroPage } from './pages/QuadroPage'
import { LessonPage } from './pages/LessonPage'
import { TrackPage } from './pages/TrackPage'
import { TracksPage } from './pages/TracksPage'

/**
 * Abas dos produtos sob a marca Horizons.
 *
 * "Trilhas" em portugues e "Invoice" em ingles de proposito: o gerador de
 * invoice mira um publico global, enquanto as trilhas sao escritas em
 * portugues para o dev brasileiro. A mistura e consciente.
 */
function Abas() {
  const { pathname } = useLocation()
  const abas = [
    { to: '/', label: 'Trilhas', ativa: pathname === '/' || pathname.startsWith('/t/') },
    { to: '/invoice', label: 'Invoice', ativa: pathname === '/invoice' },
    // QUADRO (temporario) — so em desenvolvimento. `import.meta.env.DEV` e
    // substituido por `false` no build, entao o bundle de producao nem
    // carrega a aba. Remover esta entrada junto com a pagina.
    ...(import.meta.env.DEV
      ? [{ to: '/quadro', label: 'Quadro', ativa: pathname === '/quadro' }]
      : []),
  ]

  return (
    <nav aria-label="Produtos" className="flex items-center gap-1 text-sm">
      {abas.map((aba) => (
        <Link
          key={aba.to}
          to={aba.to}
          aria-current={aba.ativa ? 'page' : undefined}
          className="rounded-md px-3 py-1.5 font-medium"
          style={{
            background: aba.ativa ? 'var(--surface-sunken)' : undefined,
            color: aba.ativa ? 'var(--text)' : 'var(--text-muted)',
          }}
        >
          {aba.label}
        </Link>
      ))}
    </nav>
  )
}

// id e tabIndex nao sao opcionais aqui: o skip link aponta para #conteudo, e
// sem eles ele morre justamente na pagina de erro.
function NotFound() {
  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-20 text-center"
    >
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
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
            <Link to="/" className="font-bold tracking-tight">
              <span style={{ color: 'var(--brand)' }}>Horizons</span>
            </Link>
            <Abas />
          </div>
        </header>

        <Routes>
          <Route path="/" element={<TracksPage />} />
          <Route path="/t/:trackSlug" element={<TrackPage />} />
          <Route path="/t/:trackSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="/invoice" element={<InvoicePage />} />
          {/* QUADRO (temporario) — remover esta rota junto com a pagina */}
          {import.meta.env.DEV && (
            <Route path="/quadro" element={<QuadroPage />} />
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
