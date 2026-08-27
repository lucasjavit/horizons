import { useId, useState } from 'react'
import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { Interruptor } from '../components/settings/Interruptor'
import { Recolhivel } from '../components/Recolhivel'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Recursos } from '../types/api'
import { AssinaturaEmail } from '../components/vagas/AssinaturaEmail'
import { AssinaturaTelegram } from '../components/vagas/AssinaturaTelegram'

/**
 * Notificações: o e-mail semanal, as métricas e o Telegram.
 *
 * Os dois canais moram juntos porque a decisão é a mesma — **por onde a vaga
 * chega em quem não está com a tela aberta**. A taxa de vinculação do Telegram
 * fica ao lado dos assinantes de e-mail de propósito: é a comparação entre os
 * dois que responde se vale investir mais num canal.
 */
export function ConfigNotificacoesPage() {
  useDocumentTitle('Notifications — Settings')

  const recursos = useAsync((signal) => api.recursos(signal), [])
  const [salvando, setSalvando] = useState(false)
  // Erro de mutação num useState separado do erro do useAsync.
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
          Notifications
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          How jobs reach people who do not have the tab open. Two channels, and
          the numbers that say whether either is working.
        </p>
      </header>

      {/*
        **As assinaturas ficam ANTES dos controles de admin, e fora deles.**

        Elas são pessoais — cada conta tem a sua cadência e o seu Telegram —,
        e as rotas por trás (`minhaAssinatura`, `definirCadencia`,
        `telegramStatus`) não são `@AdminOnly()`, ao contrário de `metricas` e
        `rodar` mais abaixo. Aninhá-las num bloco de admin as esconderia de
        quem não é, que é justamente quem as usa.

        Vieram da tela de vagas (26/08): lá ocupavam o rodapé de quem estava
        buscando, e configurar como o aviso chega é decisão de outro momento.
      */}
      <div className="mb-6 flex flex-col gap-4">
        <AssinaturaEmail />
        {/* Depois do e-mail, e não antes: o Telegram é o canal adicional
            (decisão de produto do JOB-32), e a ordem na tela diz isso. */}
        <AssinaturaTelegram />
      </div>

      {recursos.loading && <LoadingState label="Loading…" />}
      {recursos.error && (
        <ErrorState message={recursos.error} onRetry={recursos.reload} />
      )}

      {data && (
        <section
          aria-labelledby="email-switch-titulo"
          className="rounded-lg border p-5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <h2 id="email-switch-titulo" className="text-lg font-semibold">
            Weekly email
          </h2>
          <div className="mt-5">
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
          </div>
          {erroAcao && (
            <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
              {erroAcao}
            </p>
          )}
        </section>
      )}

      <MetricasDoEmail />
    </main>
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

