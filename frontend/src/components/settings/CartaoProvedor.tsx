import { useCallback, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import type { ApiProvider, ApiTokenInfo } from '../../types/api'

/** O que a tela precisa saber de um provedor para pedir a chave dele. */
export interface ProvedorDeChave {
  id: ApiProvider
  nome: string
  /** Onde a pessoa cria a chave. */
  url: string
  ondeIr: string
  prefixo: string
  /** Free tier sem cartão de crédito. */
  gratuito?: boolean
  /**
   * O provedor treina modelos com o que recebe no free tier.
   *
   * **Isto aparece acima do campo, e não é enfeite.** O texto do currículo vai
   * INTEIRO para o provedor — com CPF, endereço e telefone (JOB-02) — e a tela
   * de vagas promete que só guardamos stack, senioridade e anos. Guardar pouco
   * não é enviar pouco, e quem cadastra a chave decide com isso na mão.
   */
  treinaComOsDados?: boolean
}

/**
 * O cartão que cadastra, troca e remove a chave de um provedor.
 *
 * Compartilhado entre as sub-páginas: a de IA usa um formulário embutido na
 * linha da cadeia (o desenho de JOB-36), e Job sources usa este cartão para o
 * Firecrawl, que não é provedor de IA e não entra em cadeia nenhuma.
 */
export function CartaoProvedor({
  provedor,
  atual,
  lista,
  onMudou,
}: {
  provedor: ProvedorDeChave
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
      setErro('Paste the key before saving.')
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
        {provedor.gratuito && (
          <span
            className="rounded-full border px-2 py-0.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            free tier, no card
          </span>
        )}
        {atual && (
          <span
            className="rounded-full border px-2 py-0.5 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            stored · ends in {atual.hint}
          </span>
        )}
      </div>

      <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Generate the key at{' '}
        <a
          href={provedor.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
          style={{ color: 'var(--accent-ink)' }}
        >
          {provedor.ondeIr}
        </a>
        {provedor.prefixo ? (
          <>
            {' '}
            Starts with <code className="font-mono">{provedor.prefixo}</code>.
          </>
        ) : null}
      </p>

      {/* O aviso que decide se a chave deve ser cadastrada. Fica ACIMA do
          campo de propósito: depois dele, a decisão já foi tomada. */}
      {provedor.treinaComOsDados && (
        <p
          className="mb-4 rounded-md border border-l-4 p-3 text-sm leading-relaxed"
          style={{
            borderColor: 'var(--border)',
            borderLeftColor: WARN_INK,
            background: 'var(--surface-sunken)',
            color: 'var(--text-muted)',
          }}
        >
          <strong style={{ color: WARN_INK }}>Trains on your data.</strong> On
          the free tier this provider may use what it receives to improve its
          models. Resume reading sends the <strong>full resume text</strong> —
          including any ID numbers, address and phone it contains. Only the
          stack, seniority and years are stored here, but everything is sent
          there.
        </p>
      )}

      <label htmlFor={idCampo} className="mb-1 block text-sm font-medium">
        {atual ? 'Replace the key' : 'Key'}
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
          {estado === 'salvando' ? 'Saving…' : 'Save'}
        </button>

        {atual &&
          (!confirmando ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="rounded-md border px-4 py-2.5 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Remove
            </button>
          ) : (
            <span role="alert" className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => void remover()}
                className="rounded-md px-3 py-2.5 text-sm font-semibold"
                style={{ background: WARN_INK, color: '#fff' }}
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-md border px-3 py-2.5 text-sm font-medium"
                style={{ borderColor: 'var(--border)' }}
              >
                Keep
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
        {estado === 'salvo' ? 'Key stored.' : ''}
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
