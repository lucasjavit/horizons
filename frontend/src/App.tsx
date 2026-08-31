import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { BotaoDeTema } from './components/BotaoDeTema'
import { InvoicePage } from './pages/InvoicePage'
// QUADRO (temporario) — remover esta linha junto com a pagina
import { QuadroPage } from './pages/QuadroPage'
// O quadro do backlog interno so aparece quando VITE_QUADRO=true. O build de
// producao (docker-compose.prod.yml) passa vazio, entao a aba some e a rota
// cai no 404 — sem apagar nada do codigo. Ausente = ausente: so a string
// 'true' liga, para um valor esquecido como '0' ou 'false' nao abrir.
const MOSTRA_QUADRO = import.meta.env.VITE_QUADRO === 'true'
import { SettingsPage } from './pages/SettingsPage'
import { ConfigIaPage } from './pages/ConfigIaPage'
import { ConfigVagasPage } from './pages/ConfigVagasPage'
import { ConfigNotificacoesPage } from './pages/ConfigNotificacoesPage'
import { EmailAcaoPage } from './pages/EmailAcaoPage'
import { BotaoGoogle } from './components/BotaoGoogle'
import { LoadingState } from './components/States'
import { aoPerderSessao, perdeuSessao, tokenStore } from './lib/auth'
import { SessaoContext } from './lib/sessao'
import { usePopover } from './lib/usePopover'
import { api } from './lib/api'
import type { AuthUser } from './types/api'
import { LessonPage } from './pages/LessonPage'
import { TrackPage } from './pages/TrackPage'
import { TracksPage } from './pages/TracksPage'
/**
 * A tela de vagas entra por `import()` dinâmico.
 *
 * É a maior do app — barra de busca, filtros, lista, caixa de currículo — e
 * **quem chega para ler uma aula nunca a abre**. Importada estaticamente ela
 * empurrou o bundle principal para 448 KB, acima do teto de 440 que o
 * `scripts/qa-rapido.py` mede (26/08).
 *
 * Mesma decisão do jsPDF no Invoice e do modal de filtros: o custo fica com
 * quem usa a feature.
 */
const VagasPage = lazy(() =>
  import('./pages/VagasPage').then((m) => ({ default: m.VagasPage })),
)

/**
 * `lazy` porque o guia de deploy sao ~450 linhas de texto que **so o dono le,
 * uma vez por publicacao** — e estava no bundle principal, que todo visitante
 * baixa. Medido em 30/08: tirar de la devolveu 15 KB ao carregamento inicial.
 */
/** `lazy` como as outras: quem nunca abre o perfil nao baixa a pagina. */
const PerfilPage = lazy(() =>
  import('./pages/PerfilPage').then((m) => ({ default: m.PerfilPage })),
)

const ConfigDeployPage = lazy(() =>
  import('./pages/ConfigDeployPage').then((m) => ({ default: m.ConfigDeployPage })),
)

/**
 * `lazy` como as outras sub-paginas pesadas: a lista de usuarios e a tabela
 * que a desenha so interessam a admin e manager, e quem chega para ler uma
 * aula nunca a abre.
 */
const ConfigUsuariosPage = lazy(() =>
  import('./pages/ConfigUsuariosPage').then((m) => ({
    default: m.ConfigUsuariosPage,
  })),
)


/**
 * Abas dos produtos sob a marca Horizons.
 *
 * "Trilhas" em portugues e "Invoice" em ingles de proposito: o gerador de
 * invoice mira um publico global, enquanto as trilhas sao escritas em
 * portugues para o dev brasileiro. A mistura e consciente.
 */


/**
 * Quem esta logado — ou o convite para entrar.
 *
 * Entrar deixou de ser porta e virou canto da barra: a pessoa le a trilha
 * primeiro e decide depois. O progresso e a razao de entrar, e so faz sentido
 * oferecer depois que ela viu o que ha para acompanhar.
 */
function Conta({
  user,
  podeSair,
  gestao,
  onEntrou,
}: {
  user: AuthUser | null
  podeSair: boolean
  /**
   * Ve o item "Settings" (PLT-04, ampliado pelo PLT-11).
   *
   * Admin e manager, e nao so o admin: desde o PLT-11 ha uma sub-pagina que o
   * manager de fato usa (Users). Usuario comum continua sem ver — nenhuma das
   * seis rotas o atende.
   */
  gestao: boolean
  onEntrou: (u: AuthUser) => void
}) {
  if (!user) return <BotaoGoogle onEntrou={onEntrou} />

  return <MenuDaConta user={user} podeSair={podeSair} gestao={gestao} />
}

/**
 * A foto abre o menu da conta.
 *
 * **O nome saiu da barra** (30/08). Ele ocupava até 12 caracteres ao lado da
 * foto para repetir o que a foto já diz — e quem está logado sabe quem é. O
 * `title` na foto devolve o nome a quem passa o mouse, sem gastar a barra.
 *
 * **E o "Sign out" saiu de botão solto para dentro do menu.** Ele era o único
 * item de conta visível o tempo todo, competindo com a navegação por atenção,
 * para uma ação que se usa raramente. Continua existindo: sem ele não há como
 * trocar de conta, e ficar preso na sessão é pior que um botão a mais.
 */
function MenuDaConta({
  user,
  podeSair,
  gestao,
}: {
  user: AuthUser
  podeSair: boolean
  gestao: boolean
}) {
  const { aberto, alternar, setAberto, caixa, gatilho } = usePopover()
  const iniciais = user.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div ref={caixa} className="relative">
      <button
        ref={gatilho}
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={`Account: ${user.name}`}
        title={`${user.name} · ${user.email}`}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" aria-hidden className="h-full w-full object-cover" />
        ) : (
          // Sem foto, a inicial — um círculo vazio não diz que há conta ali.
          <span aria-hidden className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {iniciais}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border py-1 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <ItemDoMenu to="/perfil" onIr={() => setAberto(false)}>
            Profile
          </ItemDoMenu>
          {/* **Settings para admin e manager** (PLT-11; era so admin desde
              30/08). Esconder nao substitui a protecao da rota — o backend
              exige o papel —, mas evita oferecer um caminho que so daria 403.

              **O manager entra por `/config/usuarios`, e nao por `/config`.**
              A pagina Features e `@AdminOnly()` no backend: manda-lo para la
              seria abrir a Configuracoes num erro, na unica area que ele tem
              permissao de usar. */}
          {gestao && (
            <ItemDoMenu
              to={user.role === 'MANAGER' ? '/config/usuarios' : '/config'}
              onIr={() => setAberto(false)}
            >
              Settings
            </ItemDoMenu>
          )}

          {/* Com o login desligado, "Sign out" levaria a uma tela de login que
              o servidor não aceita — sairia para lugar nenhum. */}
          {podeSair && (
            <>
              <hr className="my-1" style={{ borderColor: 'var(--border)' }} />
              <button
                type="button"
                role="menuitem"
                onClick={perdeuSessao}
                className="block w-full px-4 py-2.5 text-left text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Uma linha do menu da conta. */
function ItemDoMenu({
  to,
  onIr,
  children,
}: {
  to: string
  onIr: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onIr}
      className="block px-4 py-2.5 text-sm"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </Link>
  )
}

function Abas() {
  const { pathname } = useLocation()
  const abas = [
    { to: '/', label: 'Tracks', ativa: pathname === '/' || pathname.startsWith('/t/') },
    { to: '/vagas', label: 'Jobs', ativa: pathname === '/vagas' },
    { to: '/invoice', label: 'Invoice', ativa: pathname === '/invoice' },
  ]

  // QUADRO (temporario) — o quadro do backlog, para acompanhar o trabalho
  // enquanto o projeto esta sendo construido. Fora do build publico: o
  // backlog interno nao e para quem chega de fora.
  if (MOSTRA_QUADRO) {
    abas.push({ to: '/quadro', label: 'Board', ativa: pathname === '/quadro' })
  }

  return (
    // `min-w-0` + `overflow-x-auto`: sem os dois a nav empurra a barra e a
    // pagina inteira ganha rolagem horizontal em telas estreitas (medido:
    // 525px de conteudo numa viewport de 390, em Trilhas, Invoice e Vagas).
    // A rolagem fica DENTRO da nav, que e o conteudo que de fato nao cabe.
    <nav
      aria-label="Products"
      className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
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
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link
        to="/"
        className="mt-4 inline-block font-medium underline"
        style={{ color: 'var(--accent-ink)' }}
      >
        Back to tracks
      </Link>
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  // Distingue "ainda nao sei" de "nao ha sessao": sem isso a tela de login
  // pisca antes de o token guardado ser confirmado.
  const [conferido, setConferido] = useState(false)
  // Login desligado no servidor (AUTH_DISABLED). Muda duas coisas na tela:
  // nao ha para onde sair, e a engrenagem nao pode depender de papel.
  const [semLogin, setSemLogin] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()

    async function abrirSessao() {
      // Pergunta primeiro se o login esta ligado. Com AUTH_DISABLED o servidor
      // responde a qualquer requisicao como a conta de desenvolvimento, entao
      // /auth/me ja devolve o usuario e nao ha tela de login para mostrar.
      try {
        const cfg = await api.authConfig(ctrl.signal)
        if (cfg.authDisabled) {
          setSemLogin(true)
          setUser(await api.me(ctrl.signal))
          return
        }
      } catch {
        // API fora do ar: cai no caminho normal e a tela de login explica.
      }

      if (!tokenStore.get()) return
      // O token guardado so vale depois que o servidor confirma — ele pode ter
      // expirado ou a conta ter sido desativada desde a ultima visita.
      try {
        setUser(await api.me(ctrl.signal))
      } catch {
        tokenStore.clear()
      }
    }

    void abrirSessao().finally(() => setConferido(true))
    return () => ctrl.abort()
  }, [])

  const sair = useCallback(() => setUser(null), [])
  useEffect(() => aoPerderSessao(sair), [sair])

  if (!conferido) {
    return (
      <div className="min-h-dvh">
        <LoadingState label="Loading…" />
      </div>
    )
  }

  // Sem portao: a aplicacao renderiza com ou sem sessao. Ler a trilha e o que
  // convence alguem a criar conta, entao pedir a conta antes de mostrar a
  // trilha inverte a ordem — e e o que faz a pessoa fechar a aba.
  return (
    <SessaoContext.Provider value={user}>
    <BrowserRouter>
      <div className="min-h-dvh">
        {/* Primeiro elemento focável da página: sem ele, a sidebar da aula
            impõe 78 tabulações antes do conteúdo. Só aparece com foco. */}
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:px-4 focus:py-2 focus:font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          Skip to content
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
            {/* Com o login desligado o backend nao checa papel, e ADMIN_EMAILS
                costuma estar vazio: exigir ADMIN aqui esconderia a
                Configuracoes de quem desligou o login justamente para mexer
                nela. */}
            {/* O tema veio da barra de busca (26/08): ele vale para o app
                inteiro, e ali só existia para quem chegava à tela de Jobs. */}
            <BotaoDeTema />
            <Conta
              user={user}
              podeSair={!semLogin}
              gestao={
                semLogin || user?.role === 'ADMIN' || user?.role === 'MANAGER'
              }
              onEntrou={setUser}
            />
            </div>
          </div>
        </header>

        {/* `fallback={null}`: o chunk é pequeno e carrega em milissegundos;
            um "Loading…" piscando seria mais ruído que informação. As páginas
            têm seus próprios estados de carregamento para os DADOS. */}
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<TracksPage />} />
          <Route path="/t/:trackSlug" element={<TrackPage />} />
          <Route path="/t/:trackSlug/:lessonSlug" element={<LessonPage />} />
          <Route path="/vagas" element={<VagasPage />} />
          {/* **`/salvas` continua existindo, e renderiza a tela de Jobs já
              na visão de salvas** (26/08). A aba própria saiu da navegação —
              buscar e reler o que se guardou acontecem no mesmo lugar —, mas
              links antigos e o menu continuam funcionando. */}
          <Route path="/salvas" element={<VagasPage salvas />} />
          <Route path="/invoice" element={<InvoicePage />} />
          {/* As sub-rotas vem ANTES de `/config`: nao ha `:param` aqui, mas
              manter a mais especifica primeiro e a regra da casa e evita
              surpresa se um dia `/config/:secao` existir. */}
          <Route path="/config/ia" element={<ConfigIaPage />} />
          <Route path="/config/vagas" element={<ConfigVagasPage />} />
          <Route
            path="/config/notificacoes"
            element={<ConfigNotificacoesPage />}
          />
          <Route path="/config/usuarios" element={<ConfigUsuariosPage />} />
          <Route path="/config/deploy" element={<ConfigDeployPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/config" element={<SettingsPage />} />
          {/* Os links do e-mail caem aqui, e funcionam SEM login (JOB-24 e
              JOB-25): a credencial e o token na query, nao a sessao. */}
          <Route path="/email/sair" element={<EmailAcaoPage acao="sair" />} />
          <Route
            path="/email/contratado"
            element={<EmailAcaoPage acao="contratado" />}
          />
          {/* QUADRO (temporario) — remover esta rota junto com a pagina.
              Sem a flag a rota nem e registrada, entao /quadro cai no 404:
              esconder so a aba deixaria a URL funcionando para quem soubesse
              digita-la. */}
          {MOSTRA_QUADRO && <Route path="/quadro" element={<QuadroPage />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
    </SessaoContext.Provider>
  )
}
