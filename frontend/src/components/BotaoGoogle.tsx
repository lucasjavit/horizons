import { useCallback, useEffect, useRef, useState } from 'react'
import { WARN_INK } from './blocks/BlockRenderer'
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
        renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
      }
    }
  }
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
      g.accounts.id.renderButton(caixa.current, {
        theme: 'outline',
        size: tamanho === 'compacto' ? 'medium' : 'large',
        text: 'signin_with',
        shape: 'pill',
        locale: 'pt-BR',
      })
      setPronto(true)
    }

    void preparar()
    return () => {
      cancelado = true
      ctrl.abort()
    }
  }, [entrar, tamanho])

  return (
    <div className="flex items-center gap-2">
      {/* O Google desenha o proprio botao aqui dentro. Enquanto nao desenha,
          a caixa fica com altura zero e nao empurra o layout. */}
      <div ref={caixa} />
      {erro && (
        <span role="alert" className="text-xs" style={{ color: WARN_INK }}>
          {erro}
        </span>
      )}
      {/* Nada de placeholder enquanto carrega: um "Entrar" falso que vira o
          botao do Google meio segundo depois pisca e desloca a barra. */}
      {!pronto && !erro && <span className="sr-only">Carregando login…</span>}
    </div>
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
      erro(new Error('Falha ao carregar o Google Sign-In'))
    }
    document.head.appendChild(s)
  })
  return carregamento
}
