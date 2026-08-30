import { useCallback, useEffect, useRef, useState } from 'react'
import { WARN_INK } from './blocks/BlockRenderer'
import { BOTAO_ICONE } from './botao-icone'
import { api, errorMessage } from '../lib/api'
import { tokenStore } from '../lib/auth'
import type { AuthUser } from '../types/api'

/** O que o Google Identity Services expõe em window. */
interface JanelaComGoogle {
  google?: {
    accounts: {
      id: {
        initialize: (o: {
          client_id: string
          callback: (r: { credential: string }) => void
        }) => void
        /**
         * Abre o seletor de conta sem desenhar botao nenhum.
         *
         * E o que permite o botao ser nosso: o Google cuida do fluxo e da
         * escolha de conta, e a aparencia do gatilho fica com a aplicacao.
         */
        prompt: (ouvinte?: (n: NotificacaoDoPrompt) => void) => void
      }
    }
  }
}

/** O que o Google devolve quando o seletor nao chega a aparecer. */
interface NotificacaoDoPrompt {
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  getNotDisplayedReason?: () => string
}

const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client'

interface BotaoGoogleProps {
  onEntrou: (u: AuthUser) => void
  /** `compacto` para a barra; `normal` para uma página inteira. */
  tamanho?: 'compacto' | 'normal'
}

/**
 * Botão oficial do Google Sign-In, para colocar onde couber.
 *
 * Fica na barra de navegação: entrar não interrompe a leitura, e depois de
 * escolher a conta a pessoa continua na mesma página — a aula que estava
 * lendo passa a contar progresso, sem ida e volta por uma tela de login.
 *
 * O script do Google só é baixado depois que o backend confirma que há
 * `GOOGLE_CLIENT_ID`. Sem ele, nada é renderizado: um botão que abre um erro
 * do Google é pior que botão nenhum.
 */
export function BotaoGoogle({ onEntrou, tamanho = 'compacto' }: BotaoGoogleProps) {
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  const entrar = useCallback(
    async (credential: string) => {
      setErro(null)
      try {
        const { user, accessToken } = await api.loginComGoogle(credential)
        tokenStore.set(accessToken)
        onEntrou(user)
      } catch (e) {
        setErro(errorMessage(e))
      }
    },
    [onEntrou],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelado = false

    async function preparar() {
      let clientId: string
      try {
        const config = await api.authConfig(ctrl.signal)
        if (!config.enabled || !config.googleClientId) return
        clientId = config.googleClientId
      } catch {
        return
      }

      await carregarScript()
      if (cancelado) return

      const g = (window as unknown as JanelaComGoogle).google
      if (!g || !caixa.current) return

      g.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => void entrar(r.credential),
      })
      // **O botao e NOSSO, e nao o `renderButton` do Google** (30/08).
      //
      // O `renderButton` desenha dentro de um `<iframe>` de outra origem: nao
      // se estiliza por CSS, nao le os tokens da casa, e as opcoes que ele
      // aceita (`theme`, `type`, `shape`) sao um menu fechado. O resultado era
      // um retangulo branco de ~180px na barra escura — a unica coisa clara do
      // cabecalho, e a que o stakeholder pediu para tirar.
      //
      // `prompt()` abre o mesmo seletor de conta do Google sem desenhar nada,
      // entao o gatilho pode ser um `<button>` normal. As diretrizes de marca
      // pedem o logotipo colorido e o rotulo "Sign in with Google" — a pagina
      // de vagas mantem o rotulo, e a barra fica so com o logotipo, que a
      // propria variante `icon` do Google autoriza.
      caixa.current.replaceChildren()
      setPronto(true)
    }

    void preparar()
    return () => {
      cancelado = true
      ctrl.abort()
    }
  }, [entrar])

  /**
   * Abre o seletor de conta do Google.
   *
   * O `prompt()` pode nao aparecer — o navegador bloqueia terceiros, a pessoa
   * dispensou o aviso tres vezes seguidas, ou ha uma extensao no caminho. Nesse
   * caso ele avisa pelo ouvinte em vez de lancar, e sem este tratamento o
   * clique nao faria nada e pareceria botao quebrado.
   */
  const abrirSeletor = useCallback(() => {
    const g = (window as unknown as JanelaComGoogle).google
    if (!g) {
      setErro('Sign-in is not available right now. Reload the page and try again.')
      return
    }
    setErro(null)
    g.accounts.id.prompt((n) => {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        setErro('Google could not open the account picker. Check if a browser extension is blocking it.')
      }
    })
  }, [])

  const compacto = tamanho === 'compacto'

  return (
    <div className="flex items-center gap-2">
      {/* A caixa continua existindo para o `initialize` ter onde ancorar, e
          fica vazia: quem desenha agora somos nos. */}
      <div ref={caixa} className="hidden" />

      {pronto && (
        <button
          type="button"
          onClick={abrirSeletor}
          aria-label="Sign in with Google"
          className={
            compacto
              ? `flex h-9 w-9 items-center justify-center rounded-full border ${BOTAO_ICONE}`
              : `inline-flex min-h-10 items-center gap-2.5 rounded-full border px-4 text-sm font-medium ${BOTAO_ICONE}`
          }
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <LogoGoogle />
          {/* **O rotulo so na versao normal.** As diretrizes de marca do
              Google pedem o logotipo colorido e um rotulo; a variante so-icone
              e prevista por elas, e e o que a barra usa. Quem navega por
              teclado ou leitor de tela ouve o `aria-label` nos dois casos. */}
          {!compacto && <span>Sign in with Google</span>}
        </button>
      )}

      {erro && (
        <span role="alert" className="text-xs" style={{ color: WARN_INK }}>
          {erro}
        </span>
      )}
      {/* Nada de placeholder enquanto carrega: um "Entrar" falso que vira o
          botao do Google meio segundo depois pisca e desloca a barra. */}
      {!pronto && !erro && <span className="sr-only">Loading sign-in…</span>}
    </div>
  )
}

/**
 * O logotipo do Google, nas cores oficiais.
 *
 * SVG inline e nao imagem: sao 4 caminhos, carrega junto com o bundle, e as
 * cores **nao** saem dos tokens da casa de proposito — a marca do Google e
 * dela, e as diretrizes proibem recolorir.
 */
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

let carregamento: Promise<void> | null = null

/**
 * Injeta o script do Google uma vez só.
 *
 * `<script>` clássico e não `import()`: é o que o Google publica, e — como
 * descobrimos no INV-05 — uma falha de rede num import() do ESM fica cacheada
 * para sempre, enquanto o script comum pode ser tentado de novo.
 */
export function carregarScript(): Promise<void> {
  if (carregamento) return carregamento
  carregamento = new Promise<void>((ok, erro) => {
    if ((window as unknown as JanelaComGoogle).google) {
      ok()
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_GOOGLE
    s.async = true
    s.defer = true
    s.onload = () => ok()
    s.onerror = () => {
      s.remove()
      carregamento = null
      erro(new Error('Failed to load Google Sign-In'))
    }
    document.head.appendChild(s)
  })
  return carregamento
}
