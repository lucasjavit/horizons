import { useCallback, useId, useState } from 'react'
import { Recolhivel } from '../components/Recolhivel'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { ApiProvider, ApiTokenInfo, IaDaBusca, Recursos } from '../types/api'

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
  {
    id: 'FIRECRAWL',
    nome: 'Firecrawl (job search)',
    url: 'https://www.firecrawl.dev/app/api-keys',
    ondeIr: 'firecrawl.dev → app → API keys',
    prefixo: 'fc-',
  },
]

export function SettingsPage() {
  useDocumentTitle('Settings')

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
          Settings
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          Keys and tokens for the services this application uses.
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
        <p className="font-medium">About the keys stored here</p>
        <p className="mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          They stay on the server, encrypted, and the value never comes back
          to the screen — only the last four characters. This area is restricted
          to administrators. Even so, use keys with limited scope and revoke them
          at the provider if you have any doubt.
        </p>
      </div>

      {loading && <LoadingState label="Loading keys…" />}
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

      <Recursos />
      <MetricasDoEmail />
    </main>
  )
}

/**
 * Recursos que dependem de chave de IA.
 *
 * O interruptor fica **desabilitado sem chave**, e diz por quê. Um toggle que
 * liga sem a dependência não liga nada — só empurra a falha para o momento em
 * que alguém sobe um currículo e recebe erro.
 */
function Recursos() {
  const { data, loading, error, reload, setData } = useAsync(
    (signal) => api.recursos(signal),
    [],
  )
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const alternarIa = async (ia: IaDaBusca) => {
    setErroAcao(null)
    setSalvando(true)
    try {
      setData(await api.definirIaDaBusca(ia))
    } catch (e) {
      setErroAcao(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }

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
    <section
      aria-labelledby="recursos-titulo"
      className="mt-10 rounded-lg border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="recursos-titulo" className="text-lg font-semibold">
        Features
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        What the application can do with the keys above.
      </p>

      {loading && <LoadingState label="Loading…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="mt-5">
          {/* label envolvendo o input: o texto inteiro vira alvo de clique,
              sem precisar casar id com htmlFor. */}
          <div className="flex flex-col gap-5">
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
              ajudaSemChave="Add the Firecrawl token above to be able to turn this on. Without it the search is done by the AI."
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
            <Interruptor
              id="email-semanal"
              titulo="Send the weekly jobs email"
              // O que a tela mostra e a ESCOLHA do admin, e nao `emailAtivo`.
              // Sem SMTP `emailAtivo` e sempre false, e um interruptor que nao
              // reflete o clique parece quebrado — a ausencia de entrega e
              // dita no texto de ajuda, que e onde ela cabe.
              ligado={data.emailLigado}
              // Deixa ligar sem SMTP de proposito: assim a rodada monta o
              // e-mail de verdade e o escreve no log, que e como se confere a
              // feature enquanto nao ha provedor.
              temDependencia
              salvando={salvando}
              onAlternar={() =>
                void alternar(api.definirEmailSemanal, data.emailLigado)
              }
              ajudaLigada={
                data.temProvedorDeEmail
                  ? 'Everyone with a saved profile receives, once a week, the new jobs for their group. A week with no new jobs generates no email.'
                  : 'On, but with NO EMAIL SERVER: the message is assembled and written to the API log, not sent. Set SMTP_HOST to start delivering.'
              }
              ajudaDesligada="Turned off, nobody receives job emails. The search keeps running and jobs keep showing up on screen."
              ajudaSemChave=""
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
            <Interruptor
              id="motor-ats"
              titulo="Search ATS directly"
              ligado={data.atsAtivo}
              // Sem dependência: as APIs de Greenhouse, Lever e Ashby são
              // públicas. É o único recurso aqui que não pede chave.
              temDependencia
              salvando={salvando}
              onAlternar={() => void alternar(api.definirAts, data.atsAtivo)}
              ajudaLigada="Queries jobs straight from the system where the company posts them (Greenhouse, Lever, Ashby). It is free, brings hundreds of jobs and the salary comes from the field — but it does not say whether the job accepts people living abroad."
              ajudaDesligada="Turned off, the search uses only Firecrawl or the AI — which cost money and bring fewer jobs."
              ajudaSemChave=""
            />
            <EscolhaDeIa
              data={data}
              salvando={salvando}
              onEscolher={(ia) => void alternarIa(ia)}
            />
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
              ajudaSemChave="Add an Anthropic key above to be able to turn this on. Without it the upload would not work, and a switch left on would promise something that fails at the moment of use."
            />
          </div>

          {erroAcao && (
            <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
              {erroAcao}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * A metrica que o JOB-25 existe para produzir.
 *
 * **"Quantas pessoas o Horizons empregou" e o numero que vende o produto para
 * o proximo usuario** — por isso ele vem primeiro e grande, e o resto e
 * contexto ao lado.
 */
function MetricasDoEmail() {
  const { data, loading, error, reload } = useAsync(
    (signal) => api.metricasEmail(signal),
    [],
  )
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [erroRodada, setErroRodada] = useState<string | null>(null)

  const rodar = async () => {
    setErroRodada(null)
    setResultado(null)
    setRodando(true)
    try {
      const r = await api.rodarEmail()
      setResultado(
        `${r.considerados} considered · ${r.enviados} emails · ` +
          `${r.enviadosTelegram} telegram · ` +
          `${r.pulados} skipped · ${r.falhas} failures` +
          (r.provedorEntrega ? '' : ` (provider "${r.provedor}" does not deliver — only logged)`) +
          (r.provedorTelegramEntrega ? '' : ' (Telegram off — only logged)'),
      )
      reload()
    } catch (e) {
      setErroRodada(errorMessage(e))
    } finally {
      setRodando(false)
    }
  }

  return (
    <section
      aria-labelledby="metricas-email-titulo"
      className="mt-10 rounded-lg border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="metricas-email-titulo" className="text-lg font-semibold">
        Job notifications
      </h2>

      {loading && <LoadingState label="Loading…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            People hired
          </p>
          <p
            className="text-4xl font-semibold"
            style={{ color: 'var(--accent-ink)' }}
          >
            {data.contratados}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Numero rotulo="Subscribers" valor={data.assinantes} />
            <Numero rotulo="Receiving" valor={data.ativos} />
            <Numero rotulo="Once a month" valor={data.emCadenciaMensal} />
            <Numero rotulo="Have received" valor={data.jaReceberamAlgum} />
          </dl>

          {/* **A taxa de vinculação do Telegram** — o número que o JOB-32
              existe para produzir, e o que decide se vale investir mais no
              canal. Fica ao lado dos assinantes de propósito: é a comparação
              entre os dois canais que responde a pergunta. */}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Numero rotulo="Telegram linked" valor={data.telegramVinculados} />
            <Numero rotulo="Telegram receiving" valor={data.telegramAtivos} />
          </dl>

          {/* **Sempre visível, recolhido.**
              Esconder quando "está ligado" pressupõe que ligado é o mesmo que
              funcionando — e não é: o token daqui está presente e devolve 401.
              Como referência, ele também serve para trocar o bot, refazer o
              túnel ou entender por que o envio falha. O título muda conforme o
              estado; o conteúdo fica. */}
          <TutorialTelegram
            ligado={data.telegramLigado}
            vinculados={data.telegramVinculados}
          />

          {!data.provedorEntrega && (
            <p className="mt-4 text-sm" style={{ color: WARN_INK }}>
              No email server configured (provider “{data.provedor}”): messages
              are assembled and written to the API log, not sent.
            </p>
          )}

          <button
            type="button"
            onClick={() => void rodar()}
            disabled={rodando}
            className="mt-5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {rodando ? 'Running…' : 'Run now'}
          </button>

          {resultado && (
            <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
              {resultado}
            </p>
          )}
          {erroRodada && (
            <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
              {erroRodada}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <dt style={{ color: 'var(--text-muted)' }}>{rotulo}</dt>
      <dd className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
        {valor}
      </dd>
    </div>
  )
}

/**
 * Um recurso que depende de credencial de terceiro.
 *
 * Fica **desabilitado sem a dependencia**, e diz por que. Um toggle que liga
 * sem a chave nao liga nada — so empurra a falha para o momento do uso.
 */
function Interruptor({
  id,
  titulo,
  ligado,
  temDependencia,
  salvando,
  onAlternar,
  ajudaLigada,
  ajudaDesligada,
  ajudaSemChave,
}: {
  id: string
  titulo: string
  ligado: boolean
  temDependencia: boolean
  salvando: boolean
  onAlternar: () => void
  ajudaLigada: string
  /**
   * O que acontece com o recurso DESLIGADO, quando isso não é só "nada
   * acontece". O interruptor do Firecrawl desligado não para a busca — passa
   * para a IA —, e sem dizer isso a pessoa desliga achando que desligou a
   * busca inteira. Opcional: recurso cujo desligado é só ausência não precisa.
   */
  ajudaDesligada?: string
  ajudaSemChave: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={ligado}
        disabled={!temDependencia || salvando}
        onChange={onAlternar}
        aria-describedby={`${id}-ajuda`}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)] disabled:opacity-50"
      />
      <span>
        <span className="block text-sm font-medium">{titulo}</span>
        <span
          id={`${id}-ajuda`}
          className="mt-0.5 block text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {!temDependencia
            ? ajudaSemChave
            : ligado
              ? ajudaLigada
              : (ajudaDesligada ?? ajudaLigada)}
        </span>
      </span>
    </label>
  )
}

/**
 * Qual IA faz a busca quando o Firecrawl esta desligado.
 *
 * **E preferencia, nao exigencia.** Escolher a que ainda nao tem chave e
 * legitimo — a pessoa diz qual quer usar quando cadastrar, e ate la a outra
 * atende. Por isso a opcao sem chave fica selecionavel, e a tela avisa qual
 * esta valendo de fato em vez de silenciosamente usar outra.
 */
function EscolhaDeIa({
  data,
  salvando,
  onEscolher,
}: {
  data: Recursos
  salvando: boolean
  onEscolher: (ia: IaDaBusca) => void
}) {
  const opcoes: { id: IaDaBusca; nome: string; temChave: boolean }[] = [
    { id: 'anthropic', nome: 'Claude (Anthropic)', temChave: data.temChaveAnthropic },
    { id: 'openai', nome: 'ChatGPT (OpenAI)', temChave: data.temChaveOpenAi },
  ]
  const caiuNaOutra =
    data.iaEfetiva !== null && data.iaEfetiva !== data.iaPreferida

  return (
    <fieldset className="border-0 p-0">
      <legend className="text-sm font-medium">AI that runs the search</legend>
      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Used when Firecrawl is turned off.
      </p>

      <div className="mt-2.5 flex flex-col gap-2">
        {opcoes.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="radio"
              name="ia-da-busca"
              checked={data.iaPreferida === o.id}
              disabled={salvando}
              onChange={() => onEscolher(o.id)}
              className="h-4 w-4 shrink-0 accent-[var(--brand)] disabled:opacity-50"
            />
            <span className="text-sm">
              {o.nome}
              {!o.temChave && (
                <span style={{ color: 'var(--text-muted)' }}> — no key registered</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {caiuNaOutra && (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          The selected one has no key, so the search is using{' '}
          {data.iaEfetiva === 'openai' ? 'ChatGPT' : 'Claude'}.
        </p>
      )}
      {data.iaEfetiva === null && (
        <p className="mt-2 text-sm" style={{ color: WARN_INK }}>
          Neither one has a key. With Firecrawl turned off, the search has no
          way to run.
        </p>
      )}
    </fieldset>
  )
}

/**
 * Como ligar o Telegram, passo a passo.
 *
 * Dizer "desligado, falta o `TELEGRAM_BOT_TOKEN`" nomeia o obstáculo sem
 * remover nenhum: quem lê ainda precisa descobrir onde se cria um bot, o que é
 * um webhook e por que a URL tem de ser pública. São quatro passos de dois
 * minutos, e escrevê-los aqui é a diferença entre um aviso e uma instrução.
 *
 * Recolhido por padrão porque a maioria das visitas a esta tela não é para
 * configurar o Telegram — mas o título já diz que a resposta está aqui.
 */
function TutorialTelegram({
  ligado,
  vinculados,
}: {
  ligado: boolean
  vinculados: number
}) {
  const [aberto, setAberto] = useState(false)
  const id = useId()

  const passo = 'mt-3 text-sm leading-relaxed'
  const codigo =
    'rounded px-1.5 py-0.5 font-mono text-xs'

  return (
    <div
      className="mt-4 rounded-lg border"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium"
        style={{ color: 'var(--text)' }}
      >
        <span>
          {!ligado
            ? 'Telegram off — how to turn it on'
            : vinculados === 0
              ? 'Telegram configured — nobody connected yet'
              : 'Telegram — how to set up or switch the bot'}
        </span>
        <span aria-hidden style={{ color: 'var(--text-muted)' }}>
          {aberto ? '▴' : '▾'}
        </span>
      </button>

      <Recolhivel aberto={aberto} id={id}>
        <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border)' }}>
          <p className={passo} style={{ color: 'var(--text-muted)' }}>
            {!ligado
              ? 'While it is off, the option does not appear on the Jobs tab and nothing is sent through it. There are four steps, and none of them costs money.'
              : 'A token being present is not a token that works: if the API log shows 401 when sending, it is invalid — redo step 1. The steps also work for switching the bot or rebuilding the tunnel.'}
          </p>

          <ol className="mt-3 flex flex-col gap-3">
            <li className="text-sm leading-relaxed">
              <strong>1. Create the bot.</strong> On Telegram, talk to{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: 'var(--brand)' }}
              >
                @BotFather
              </a>{' '}
              and send <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>/newbot</code>.
              It asks for a name and a username ending in <em>bot</em>, and
              returns a token that looks like{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>
                8123456789:AAH…
              </code>
            </li>

            <li className="text-sm leading-relaxed">
              <strong>2. Store the token on the server.</strong> In{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>.env</code>:
              <pre
                className="mt-2 overflow-x-auto rounded-md p-3 text-xs"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text)' }}
              >{`TELEGRAM_BOT_TOKEN=8123456789:AAH…
TELEGRAM_BOT_USERNAME=your_bot
TELEGRAM_WEBHOOK_SECRET=a-long-random-phrase`}</pre>
              <span style={{ color: 'var(--text-muted)' }}>
                The secret is what makes the webhook reject anyone who is not
                Telegram — without it, anyone could forge messages.
              </span>
            </li>

            <li className="text-sm leading-relaxed">
              <strong>3. Give Telegram a public address.</strong> It only
              delivers over HTTPS, and does not reach <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>localhost</code>.
              In production that is the site URL; in development, a tunnel:
              <pre
                className="mt-2 overflow-x-auto rounded-md p-3 text-xs"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text)' }}
              >{`# in a separate terminal
npx localtunnel --port 3333

TELEGRAM_WEBHOOK_URL=https://what-it-returned/api/telegram/webhook`}</pre>
              <span style={{ color: 'var(--text-muted)' }}>
                The API registers the webhook itself on boot, and reports in
                the log if Telegram rejects it.
              </span>
            </li>

            <li className="text-sm leading-relaxed">
              <strong>4. Restart and connect.</strong>{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>
                docker compose up -d --build api
              </code>
              , go back to the Jobs tab and click <em>Connect Telegram</em>. The
              bot cannot start a conversation — you are the one who has to send{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>/start</code>,
              and the button does that through the link.
            </li>
          </ol>

          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Why Telegram and not
            email:</strong>{' '}
            the free sending plans (Resend, Brevo) require your own domain with
            DKIM, SPF and DMARC — buying a domain, configuring DNS and waiting
            for propagation before the first message goes out. Telegram delivers
            with the token above, with no domain and no cost.
          </p>
        </div>
      </Recolhivel>
    </div>
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
        . Starts with <code className="font-mono">{provedor.prefixo}</code>.
      </p>

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
