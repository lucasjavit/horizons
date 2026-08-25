import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { Interruptor } from '../components/settings/Interruptor'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Recursos } from '../types/api'

/**
 * Features: os interruptores de produto que sobraram da divisão.
 *
 * **Esta página era `/config` inteira, com 864 linhas.** Ela juntava chaves de
 * seis provedores, três motores de busca, e-mail, Telegram e os interruptores
 * — e com seis provedores teria ~3.190px de rolagem. Virou quatro páginas com
 * a barra de abas comum; aqui ficou o que é decisão de produto e não
 * configuração de serviço externo.
 *
 * `/config` continua sendo esta rota (e não `/config/features`) para não
 * quebrar o link da engrenagem nem o hábito de quem já usa a tela.
 */
export function SettingsPage() {
  useDocumentTitle('Features — Settings')

  const { data, loading, error, reload, setData } = useAsync(
    (signal) => api.recursos(signal),
    [],
  )
  const [salvando, setSalvando] = useState(false)
  // Erro de mutação num useState separado do erro do useAsync: um 400 ao
  // ligar um interruptor não pode apagar a página e pedir "try again".
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const alternar = async (
    fn: (ativa: boolean) => Promise<Recursos>,
    atual: boolean,
  ) => {
    setErroAcao(null)
    setSalvando(true)
    try {
      setData(await fn(!atual))
    } catch (e) {
      setErroAcao(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <AbasDeConfig />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Features
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          What the application offers people. Each switch changes what shows up
          on the Jobs tab.
        </p>
      </header>

      <div
        className="mb-7 rounded-lg border border-l-4 p-4 text-sm"
        style={{
          borderColor: 'var(--border)',
          borderLeftColor: WARN_INK,
          background: 'var(--surface-sunken)',
        }}
      >
        <p className="font-medium">This area is for administrators</p>
        <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Keys live under{' '}
          <Link
            to="/config/ia"
            className="font-medium underline"
            style={{ color: 'var(--accent-ink)' }}
          >
            AI providers
          </Link>{' '}
          and{' '}
          <Link
            to="/config/vagas"
            className="font-medium underline"
            style={{ color: 'var(--accent-ink)' }}
          >
            Job sources
          </Link>
          . They stay on the server, encrypted, and the value never comes back
          to the screen — only the last four characters. Even so, use keys with
          limited scope and revoke them at the provider if you have any doubt.
        </p>
      </div>

      {loading && <LoadingState label="Loading…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <section
          aria-labelledby="recursos-titulo"
          className="rounded-lg border p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <h2 id="recursos-titulo" className="text-lg font-semibold">
            What people can do
          </h2>

          <div className="mt-5 flex flex-col gap-5">
            <Interruptor
              id="leitura-cv"
              titulo="Read resumes in PDF or DOCX"
              ligado={data.leituraCvAtiva}
              temDependencia={data.temChaveDeIa}
              salvando={salvando}
              onAlternar={() =>
                void alternar(api.definirLeituraCv, data.leituraCvAtiva)
              }
              ajudaLigada="People can upload their resume and the filters come prefilled. The file is sent to the AI provider to be read and is not stored — only stack, seniority and years."
              ajudaSemChave="Add a key for any AI provider under AI providers to be able to turn this on. Without it the upload would not work, and a switch left on would promise something that fails at the moment of use."
            />

            <Interruptor
              id="historico"
              titulo="Keep the job history"
              ligado={data.historicoAtivo}
              // Sem dependência: o histórico só grava a URL do que a própria
              // pessoa marcou. Não chama serviço nenhum de fora.
              temDependencia
              salvando={salvando}
              onAlternar={() =>
                void alternar(api.definirHistorico, data.historicoAtivo)
              }
              ajudaLigada="Everyone sees the “New” badge on jobs they have not opened yet, and can dismiss the ones that do not interest them — which disappear from their list. The history is private: nobody sees anyone else’s."
              ajudaDesligada="Turned off, the search always shows every job, with no badge and no dismiss button. What was already marked stays stored and comes back if the feature is turned on again."
              ajudaSemChave=""
            />
          </div>

          {erroAcao && (
            <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
              {erroAcao}
            </p>
          )}
        </section>
      )}
    </main>
  )
}
