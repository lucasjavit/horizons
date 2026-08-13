import { useCallback, useEffect, useState } from 'react'
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
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoadingState } from './components/States'
import { aoPerderSessao, perdeuSessao, tokenStore } from './lib/auth'
import { api } from './lib/api'
import type { AuthUser } from './types/api'
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
/** Atalho para as configuracoes, no canto direito do cabecalho. */
function Engrenagem({ admin }: { admin: boolean }) {
  const { pathname } = useLocation()
  const ativa = pathname === '/config'

  // Config e area de administracao (PLT-04). Esconder o icone nao substitui a
  // protecao da rota — o backend exige o papel —, mas evita oferecer um
  // caminho que so daria 403.
  if (!admin) return null

  return (
    <Link
      to="/config"
      // Icone sozinho precisa de nome acessivel: sem isto o leitor de tela
      // anuncia so "link".
      aria-label="Configurações"
      title="Configurações"
      aria-current={ativa ? 'page' : undefined}
      // 36px de alvo, acima dos 24px minimos da WCAG 2.5.8.
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={{
        background: ativa ? 'var(--surface-sunken)' : undefined,
        color: ativa ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  )
}


/** Quem esta logado, e a saida. */
function Conta({ user }: { user: AuthUser }) {
  return (
    <div className="flex items-center gap-2">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          // Decorativo: o nome ao lado ja identifica a conta, e um alt
          // repetindo "Foto de Fulano" so faria o leitor de tela dizer duas
          // vezes a mesma coisa.
          alt=""
          aria-hidden
          className="h-7 w-7 shrink-0 rounded-full object-cover"
          style={{ background: 'var(--surface-sunken)' }}
        />
      ) : null}
      <span
        className="hidden max-w-[12ch] truncate text-sm sm:inline"
        style={{ color: 'var(--text-muted)' }}
        title={user.email}
      >
        {user.name}
      </span>
      <button
        type="button"
        onClick={perdeuSessao}
        className="shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        Sair
      </button>
    </div>
  )
}

function Abas() {
  const { pathname } = useLocation()
  const abas = [
    { to: '/', label: 'Trilhas', ativa: pathname === '/' || pathname.startsWith('/t/') },
    { to: '/invoice', label: 'Invoice', ativa: pathname === '/invoice' },
    // QUADRO (temporario) — o quadro do backlog, para acompanhar o trabalho
    // enquanto o projeto esta sendo construido. Aparece em qualquer build,
    // inclusive no Docker. Remover esta entrada junto com a pagina, antes de
    // publicar: o backlog interno nao e para o publico.
    { to: '/quadro', label: 'Quadro', ativa: pathname === '/quadro' },
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
  const [user, setUser] = useState<AuthUser | null>(null)
  // Distingue "ainda nao sei" de "nao ha sessao": sem isso a tela de login
  // pisca antes de o token guardado ser confirmado.
  const [conferido, setConferido] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    if (!tokenStore.get()) {
      setConferido(true)
      return () => ctrl.abort()
    }
    // O token guardado so vale depois que o servidor confirma — ele pode ter
    // expirado ou a conta ter sido desativada desde a ultima visita.
    api
      .me(ctrl.signal)
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setConferido(true))
    return () => ctrl.abort()
  }, [])

  const sair = useCallback(() => setUser(null), [])
  useEffect(() => aoPerderSessao(sair), [sair])

  if (!conferido) {
    return (
      <div className="min-h-dvh">
        <LoadingState label="Carregando…" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-dvh">
        <LoginPage onEntrou={setUser} />
      </div>
    )
  }

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

            {/* Config e conta ficam na ponta direita, separadas das abas:
                nao sao produtos como Trilhas e Invoice. O ml-auto vive aqui,
                e nao na engrenagem, porque ela some para quem nao e admin. */}
            <div className="ml-auto flex items-center gap-2">
            <Engrenagem admin={user.role === 'ADMIN'} />
            <Conta user={user} />
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<TracksPage />} />
          <Route path="/t/:trackSlug" element={<TrackPage />} />
          <Route path="/t/:trackSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="/invoice" element={<InvoicePage />} />
          <Route path="/config" element={<SettingsPage />} />
          {/* QUADRO (temporario) — remover esta rota junto com a pagina */}
          <Route path="/quadro" element={<QuadroPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
