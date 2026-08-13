import { useCallback, useEffect, useRef, useState } from 'react'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { LoadingState } from '../components/States'
import { tokenStore } from '../lib/auth'
import { api, errorMessage } from '../lib/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'
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
        renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
      }
    }
  }
}

const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client'

/**
 * Entrada por Google Sign-In.
 *
 * O script do Google entra sob demanda, e a tela pergunta antes ao backend se
 * o login esta configurado — assim um servidor sem `GOOGLE_CLIENT_ID` mostra
 * uma mensagem em vez de um botao que nao funciona.
 */
export function LoginPage({ onEntrou }: { onEntrou: (u: AuthUser) => void }) {
  useDocumentTitle('Entrar')

  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const caixaBotao = useRef<HTMLDivElement>(null)

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
      let clientId: string | null = null
      try {
        const config = await api.authConfig(ctrl.signal)
        if (!config.enabled || !config.googleClientId) {
          setIndisponivel(
            'O login com Google não está configurado neste servidor.',
          )
          setCarregando(false)
          return
        }
        clientId = config.googleClientId
      } catch (e) {
        if (cancelado) return
        setIndisponivel(errorMessage(e))
        setCarregando(false)
        return
      }

      // O script so entra depois de sabermos que ha client id: carregar antes
      // seria pedir um recurso externo para nada.
      await carregarScript()
      if (cancelado) return

      const g = (window as unknown as JanelaComGoogle).google
      if (!g || !caixaBotao.current) {
        setIndisponivel('Não foi possível carregar o login do Google.')
        setCarregando(false)
        return
      }

      g.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => void entrar(r.credential),
      })
      g.accounts.id.renderButton(caixaBotao.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'pt-BR',
      })
      setCarregando(false)
    }

    void preparar()
    return () => {
      cancelado = true
      ctrl.abort()
    }
  }, [entrar])

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10"
    >
      <h1 className="text-3xl font-bold tracking-tight">Entrar no Horizons</h1>
      <p className="mt-2 mb-8" style={{ color: 'var(--text-muted)' }}>
        Suas trilhas, invoices e vagas ficam ligadas à sua conta.
      </p>

      {carregando && <LoadingState label="Preparando o login…" />}

      {indisponivel && (
        <div
          role="alert"
          className="rounded-lg border p-4 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-sunken)',
          }}
        >
          <p className="font-medium">Login indisponível</p>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
            {indisponivel}
          </p>
        </div>
      )}

      {/* O Google desenha o proprio botao aqui dentro. */}
      <div ref={caixaBotao} className="flex justify-center" />

      {erro && (
        <p role="alert" className="mt-4 text-sm" style={{ color: WARN_INK }}>
          {erro}
        </p>
      )}
    </main>
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
function carregarScript(): Promise<void> {
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
      erro(new Error('Falha ao carregar o Google Sign-In'))
    }
    document.head.appendChild(s)
  })
  return carregamento
}
