import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { CartaoProvedor } from '../components/settings/CartaoProvedor'
/**
 * A tabela de descobertas entra por `import()` dinâmico.
 *
 * **Ela é a única tela de admin com tabela**, e paga o próprio peso em chunk
 * separado: medido em 25/08, embutida ela levava o bundle principal a 450,3 KB
 * contra o teto de 450 KB do `qa-rapido.py` — que existe porque quem só quer
 * ler uma aula baixa esse arquivo. Fora dele, o principal volta a 445,6 KB e
 * quem abre `/config/vagas` paga os ~5 KB.
 *
 * Mesma razão do jsPDF no Invoice, na escala menor que este caso pede.
 */
const CatalogoDescoberto = lazy(() =>
  import('../components/settings/CatalogoDescoberto').then((m) => ({
    default: m.CatalogoDescoberto,
  })),
)
import { Interruptor } from '../components/settings/Interruptor'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Recursos } from '../types/api'

/**
 * De onde vêm as vagas.
 *
 * **O Firecrawl mora aqui, e não na página de IA.** Ele é implementação
 * concorrente do mesmo passo de leitura que a cadeia de IA faz — e o
 * agrupamento honesto é *de onde vêm as vagas*, não *o que usa IA por baixo*.
 * Quem abre esta página está decidindo entre motores de busca; quem abre a de
 * IA está decidindo qual provedor atende. São duas perguntas diferentes.
 */
export function ConfigVagasPage() {
  useDocumentTitle('Job sources — Settings')

  const recursos = useAsync((signal) => api.recursos(signal), [])
  const tokens = useAsync((signal) => api.listTokens(signal), [])

  const [salvando, setSalvando] = useState(false)
  // Erro de mutação separado do erro do useAsync: um 400 ao ligar um
  // interruptor não pode apagar a página e pedir "try again".
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const alternar = async (
    fn: (ativa: boolean) => Promise<Recursos>,
    atual: boolean,
  ) => {
    setErroAcao(null)
    setSalvando(true)
    try {
      recursos.setData(await fn(!atual))
    } catch (e) {
      setErroAcao(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }

  const data = recursos.data

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <AbasDeConfig />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Job sources
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Where the jobs come from. The ATS is free and brings the most; the
          others cost money or credits and go deeper on each posting.
        </p>
      </header>

      {recursos.loading && <LoadingState label="Loading…" />}
      {recursos.error && (
        <ErrorState message={recursos.error} onRetry={recursos.reload} />
      )}

      {data && (
        <>
          <section
            aria-labelledby="motores-titulo"
            className="rounded-lg border p-5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
          >
            <h2 id="motores-titulo" className="text-lg font-semibold">
              Search engines
            </h2>

            <div className="mt-5 flex flex-col gap-5">
              <Interruptor
                id="motor-ats"
                titulo="Search ATS directly"
                ligado={data.atsAtivo}
                // Sem dependência: as APIs de Greenhouse, Lever e Ashby são
                // públicas. É o único motor aqui que não pede chave.
                temDependencia
                salvando={salvando}
                onAlternar={() => void alternar(api.definirAts, data.atsAtivo)}
                ajudaLigada="Queries jobs straight from the system where the company posts them (Greenhouse, Lever, Ashby). It is free, brings hundreds of jobs and the salary comes from the field — but it does not say whether the job accepts people living abroad."
                ajudaDesligada="Turned off, the search uses only Firecrawl or the AI — which cost money and bring fewer jobs."
                ajudaSemChave=""
              />

              <Interruptor
                id="busca-vagas"
                titulo="Enable Firecrawl"
                ligado={data.firecrawlAtivo}
                temDependencia={data.temChaveFirecrawl}
                salvando={salvando}
                onAlternar={() =>
                  void alternar(api.definirBuscaVagas, data.firecrawlAtivo)
                }
                ajudaLigada="The search opens each posting through Firecrawl: it brings salary, skills and eligibility along with the excerpt that proves them. It costs credits and opens up to 8 jobs per search."
                ajudaDesligada="Turned off, the search keeps working — it is done by the AI instead, which finds more jobs and faster, with less detail on each one."
                ajudaSemChave="Add the Firecrawl token below to be able to turn this on. Without it the search is done by the AI."
              />

              <Interruptor
                id="descobertas"
                titulo="Learn from what the search finds"
                ligado={data.descobertasAtivas}
                // Sem dependência, como o ATS: a captura é parsing puro de uma
                // URL que já está em memória, e a verificação da madrugada bate
                // em API pública e sem chave.
                temDependencia
                salvando={salvando}
                onAlternar={() =>
                  void alternar(api.definirDescobertas, data.descobertasAtivas)
                }
                ajudaLigada="Every search notes the job boards it ran into that the catalog does not list. At 3am each one is checked against the real ATS — does the board exist, how many jobs does it return. Nothing is added to the catalog without a person deciding."
                ajudaDesligada="Turned off, the search records nothing and the nightly check does not run. What was already found stays in the list below."
                ajudaSemChave=""
              />

              <Interruptor
                id="busca-agendada"
                titulo="Search for jobs automatically"
                ligado={data.buscaAgendadaAtiva}
                // Depende de haver algum motor: sem nenhum, a rodada gastaria
                // tempo para não achar nada.
                temDependencia={data.buscaPossivel}
                salvando={salvando}
                onAlternar={() =>
                  void alternar(api.definirBuscaAgendada, data.buscaAgendadaAtiva)
                }
                ajudaLigada="Every 50 minutes the system searches for new jobs for everyone with a saved profile, without anyone having to click. Jobs stay for 15 days and then disappear."
                ajudaDesligada="Turned off, the search only happens when someone clicks Filter. That is what prevents spending without a request — which is why this switch starts off."
                ajudaSemChave="Requires a search engine turned on — the ATS, Firecrawl or an AI key."
              />
            </div>

            {erroAcao && (
              <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
                {erroAcao}
              </p>
            )}

            <p
              className="mt-5 border-t pt-4 text-sm leading-relaxed"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              The AI can also search on its own, and it is what runs when
              Firecrawl is off. Which provider answers is set under{' '}
              <Link
                to="/config/ia"
                className="font-medium underline"
                style={{ color: 'var(--accent-ink)' }}
              >
                AI providers
              </Link>
              .
            </p>
          </section>

          <Suspense fallback={<LoadingState label="Loading…" />}>
            <CatalogoDescoberto ligado={data.descobertasAtivas} />
          </Suspense>

          <h2 className="mt-9 mb-3 text-lg font-semibold">Firecrawl key</h2>
          {tokens.loading && <LoadingState label="Loading key…" />}
          {tokens.error && (
            <ErrorState message={tokens.error} onRetry={tokens.reload} />
          )}
          {tokens.data && (
            <CartaoProvedor
              provedor={{
                id: 'FIRECRAWL',
                nome: 'Firecrawl (job search)',
                url: 'https://www.firecrawl.dev/app/api-keys',
                ondeIr: 'firecrawl.dev → app → API keys',
                prefixo: 'fc-',
              }}
              atual={tokens.data.find((t) => t.provider === 'FIRECRAWL') ?? null}
              lista={tokens.data}
              onMudou={(lista) => {
                tokens.setData(lista)
                // A flag do Firecrawl depende da chave: sem recarregar, o
                // interruptor continuaria bloqueado depois de salvar a chave.
                void api.recursos().then(recursos.setData)
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
