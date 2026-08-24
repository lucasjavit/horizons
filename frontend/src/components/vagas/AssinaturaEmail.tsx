import { useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import type { Assinatura } from '../../types/api'

/**
 * O controle do e-mail de vagas, na tela (JOB-24 e JOB-25).
 *
 * O criterio do JOB-25 pede o botao "consegui a vaga" **no e-mail e na tela** —
 * quem foi contratado costuma perceber isso enquanto olha as vagas, e nao
 * enquanto le um e-mail de semanas atras.
 *
 * Fica no rodape da lista de proposito: e um controle de preferencia, e
 * disputar o topo com as vagas inverteria a prioridade da tela.
 */
export function AssinaturaEmail() {
  const { data, loading, error, setData } = useAsync(
    (signal) => api.minhaAssinatura(signal),
    [],
  )
  // Erro de mutacao mora num estado separado do erro do `useAsync` — padrao
  // da casa: a lista carregou, o que falhou foi o clique.
  const [erroAcao, setErroAcao] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Some em silencio enquanto carrega ou se falhar: e um controle acessorio,
  // e um erro aqui nao pode roubar a atencao de quem veio ver vagas.
  if (loading || error || !data) return null

  const agir = async (fn: () => Promise<Assinatura>) => {
    setErroAcao('')
    setSalvando(true)
    try {
      setData(await fn())
    } catch (e) {
      setErroAcao(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }

  const contratado = data.cadencia === 'mensal'

  return (
    <section
      aria-labelledby="assinatura-titulo"
      className="mt-10 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      {/* O título segue o estado REAL, e não só `contratado`. Sem isto,
          quem está inativo e marcado como contratado lia "One job a month"
          logo acima de "You're not getting job emails" (QA, 24/08). */}
      <h2 id="assinatura-titulo" className="text-base font-semibold">
        {!data.ativo
          ? 'Job emails are off'
          : contratado
            ? 'One job a month'
            : 'Weekly job email'}
      </h2>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {!data.ativo
          ? "You're not getting job emails. Turn them back on whenever you want."
          : contratado
            ? 'You get one hand-picked job a month, so you can keep an eye on the market without looking for it.'
            : 'Once a week we email you the new jobs that match your filters. No new jobs, no email.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {!data.ativo ? (
          <button
            type="button"
            disabled={salvando}
            onClick={() => void agir(() => api.definirEmailAtivo(true))}
            className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {/* O rótulo diz a cadência que a pessoa VAI receber: religar
                mantém `mensal` para quem já foi contratado, e prometer
                "new jobs" ali seria prometer o semanal. */}
            {salvando
              ? 'Saving…'
              : contratado
                ? 'Email me monthly jobs'
                : 'Email me new jobs'}
          </button>
        ) : contratado ? (
          <button
            type="button"
            disabled={salvando}
            onClick={() => void agir(() => api.definirCadencia('semanal'))}
            className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {salvando ? 'Saving…' : "I'm looking again"}
          </button>
        ) : (
          <>
            {/* O gesto que o JOB-25 existe para capturar. Verde e nao neutro:
                e a boa noticia da relacao, nao uma opcao de configuracao. */}
            <button
              type="button"
              disabled={salvando}
              onClick={() => void agir(() => api.definirCadencia('mensal'))}
              className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
            >
              {salvando ? 'Saving…' : 'I got the job 🎉'}
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void agir(() => api.definirEmailAtivo(false))}
              className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Stop emails
            </button>
          </>
        )}
      </div>

      {erroAcao && (
        <p
          role="alert"
          className="mt-3 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: WARN_INK, color: WARN_INK }}
        >
          {erroAcao}
        </p>
      )}
    </section>
  )
}
