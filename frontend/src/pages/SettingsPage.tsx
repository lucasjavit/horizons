import { useCallback, useState } from 'react'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { ApiProvider, ApiTokenInfo } from '../types/api'

/**
 * Tokens de API dos provedores de IA.
 *
 * Guardados no backend, cifrados em repouso (AES-256-GCM). O valor nunca
 * volta da API — a tela mostra so os quatro ultimos caracteres, o suficiente
 * para reconhecer qual chave esta la.
 *
 * RESSALVA CONHECIDA: o guard do backend ainda e o stub que aceita qualquer
 * `x-user-email`. Ate o login existir, isto protege contra vazamento do banco,
 * nao contra alguem se passar por voce na API.
 */

interface Provedor {
  id: ApiProvider
  nome: string
  /** Onde a pessoa cria a chave. */
  url: string
  ondeIr: string
  prefixo: string
}

const PROVEDORES: Provedor[] = [
  {
    id: 'ANTHROPIC',
    nome: 'Claude (Anthropic)',
    url: 'https://console.anthropic.com/settings/keys',
    ondeIr: 'console.anthropic.com → Settings → API keys',
    prefixo: 'sk-ant-',
  },
  {
    id: 'OPENAI',
    nome: 'ChatGPT (OpenAI)',
    url: 'https://platform.openai.com/api-keys',
    ondeIr: 'platform.openai.com → API keys',
    prefixo: 'sk-',
  },
]

export function SettingsPage() {
  useDocumentTitle('Configurações')

  const { data, loading, error, reload, setData } = useAsync(
    (signal) => api.listTokens(signal),
    [],
  )

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Configurações
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          Chaves de API dos provedores de IA usados pela aplicação.
        </p>
      </header>

      <div
        className="mb-8 rounded-lg border border-l-4 p-4 text-sm"
        style={{
          borderColor: 'var(--border)',
          borderLeftColor: WARN_INK,
          background: 'var(--surface-sunken)',
        }}
      >
        <p className="font-medium">Sobre as chaves guardadas aqui</p>
        <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Ficam no servidor, cifradas, e o valor nunca volta para a tela — só os
          quatro últimos caracteres. Ainda assim, não existe login de verdade
          nesta aplicação: use chaves com escopo limitado e revogue-as no
          provedor se tiver qualquer dúvida.
        </p>
      </div>

      {loading && <LoadingState label="Carregando as chaves…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="flex flex-col gap-5">
          {PROVEDORES.map((p) => (
            <CartaoProvedor
              key={p.id}
              provedor={p}
              atual={data.find((t) => t.provider === p.id) ?? null}
              onMudou={(lista) => setData(lista)}
              lista={data}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function CartaoProvedor({
  provedor,
  atual,
  lista,
  onMudou,
}: {
  provedor: Provedor
  atual: ApiTokenInfo | null
  lista: ApiTokenInfo[]
  onMudou: (lista: ApiTokenInfo[]) => void
}) {
  const [valor, setValor] = useState('')
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const idCampo = `token-${provedor.id.toLowerCase()}`

  const salvar = useCallback(async () => {
    const limpo = valor.trim()
    if (!limpo) {
      setErro('Cole a chave antes de salvar.')
      return
    }
    setErro(null)
    setEstado('salvando')
    try {
      const salvo = await api.setToken(provedor.id, limpo)
      onMudou([...lista.filter((t) => t.provider !== provedor.id), salvo])
      // Some da tela assim que sai daqui: chave nao fica em campo visivel.
      setValor('')
      setEstado('salvo')
    } catch (e) {
      setEstado('ocioso')
      setErro(errorMessage(e))
    }
  }, [valor, provedor.id, lista, onMudou])

  const remover = useCallback(async () => {
    setErro(null)
    try {
      await api.removeToken(provedor.id)
      onMudou(lista.filter((t) => t.provider !== provedor.id))
      setConfirmando(false)
      setEstado('ocioso')
    } catch (e) {
      setErro(errorMessage(e))
    }
  }, [provedor.id, lista, onMudou])

  return (
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      aria-labelledby={`${idCampo}-titulo`}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id={`${idCampo}-titulo`}
          className="text-lg font-semibold tracking-tight"
        >
          {provedor.nome}
        </h2>
        {atual && (
          <span
            className="rounded-full border px-2 py-0.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            guardada · termina em {atual.hint}
          </span>
        )}
      </div>

      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Gere a chave em{' '}
        <a
          href={provedor.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
          style={{ color: 'var(--accent-ink)' }}
        >
          {provedor.ondeIr}
        </a>
        . Começa com <code className="font-mono">{provedor.prefixo}</code>.
      </p>

      <label htmlFor={idCampo} className="mb-1 block text-sm font-medium">
        {atual ? 'Substituir a chave' : 'Chave'}
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <input
          id={idCampo}
          // password para nao ficar legivel por cima do ombro nem no
          // historico de formulario do navegador.
          type="password"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value)
            setEstado('ocioso')
          }}
          placeholder={`${provedor.prefixo}…`}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${idCampo}-erro` : undefined}
          className="min-w-0 flex-1 rounded-md border px-3 py-2.5 font-mono text-sm"
          style={{
            borderColor: erro ? WARN_INK : 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
          }}
        />
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={estado === 'salvando'}
          className="rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-90"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          {estado === 'salvando' ? 'Salvando…' : 'Salvar'}
        </button>

        {atual &&
          (!confirmando ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="rounded-md border px-4 py-2.5 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Remover
            </button>
          ) : (
            <span role="alert" className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => void remover()}
                className="rounded-md px-3 py-2.5 text-sm font-semibold"
                style={{ background: WARN_INK, color: '#fff' }}
              >
                Remover
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-md border px-3 py-2.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)' }}
              >
                Manter
              </button>
            </span>
          ))}
      </div>

      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        {estado === 'salvo' ? 'Chave guardada.' : ''}
      </p>

      {erro && (
        <p
          id={`${idCampo}-erro`}
          role="alert"
          className="mt-1 text-sm"
          style={{ color: WARN_INK }}
        >
          {erro}
        </p>
      )}
    </section>
  )
}
