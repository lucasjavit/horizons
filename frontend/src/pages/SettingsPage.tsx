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
    nome: 'Firecrawl (busca de vagas)',
    url: 'https://www.firecrawl.dev/app/api-keys',
    ondeIr: 'firecrawl.dev → app → API keys',
    prefixo: 'fc-',
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
          Chaves e tokens dos serviços que a aplicação usa.
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
          Ficam no servidor, cifradas, e o valor nunca volta para a tela — só
          os quatro últimos caracteres. Esta área é restrita a administradores.
          Ainda assim, use chaves com escopo limitado e revogue-as no provedor
          se tiver qualquer dúvida.
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
        Recursos
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        O que a aplicação pode fazer com as chaves acima.
      </p>

      {loading && <LoadingState label="Carregando…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="mt-5">
          {/* label envolvendo o input: o texto inteiro vira alvo de clique,
              sem precisar casar id com htmlFor. */}
          <div className="flex flex-col gap-5">
            <Interruptor
              id="busca-vagas"
              titulo="Ativar Firecrawl"
              ligado={data.firecrawlAtivo}
              temDependencia={data.temChaveFirecrawl}
              salvando={salvando}
              onAlternar={() =>
                void alternar(api.definirBuscaVagas, data.firecrawlAtivo)
              }
              ajudaLigada="A busca abre cada anúncio pelo Firecrawl: traz salário, skills e elegibilidade com o trecho que os comprova. Custa créditos e abre até 8 vagas por busca."
              ajudaDesligada="Desligado, a busca continua funcionando — passa a ser feita pela IA, que encontra mais vagas e mais rápido, com menos detalhe de cada uma."
              ajudaSemChave="Cadastre o token do Firecrawl acima para poder ligar. Sem ele a busca é feita pela IA."
            />
                        <Interruptor
              id="busca-agendada"
              titulo="Buscar vagas automaticamente"
              ligado={data.buscaAgendadaAtiva}
              // Depende de haver algum motor: sem nenhum, a rodada gastaria
              // tempo para não achar nada.
              temDependencia={data.buscaPossivel}
              salvando={salvando}
              onAlternar={() =>
                void alternar(api.definirBuscaAgendada, data.buscaAgendadaAtiva)
              }
              ajudaLigada="A cada 50 minutos o sistema busca vagas novas para quem tem perfil salvo, sem ninguém precisar clicar. As vagas ficam 15 dias e depois somem."
              ajudaDesligada="Desligado, a busca só acontece quando alguém clica em Filter. É o que evita gasto sem pedido — por isso este interruptor nasce desligado."
              ajudaSemChave="Precisa de um motor de busca ligado — o ATS, o Firecrawl ou uma chave de IA."
            />
            <Interruptor
              id="email-semanal"
              titulo="Enviar o e-mail semanal de vagas"
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
                  ? 'Cada pessoa com perfil salvo recebe, uma vez por semana, as vagas novas do grupo dela. Semana sem vaga nova não gera e-mail.'
                  : 'Ligado, mas SEM SERVIDOR DE E-MAIL: a mensagem é montada e escrita no log da API, não enviada. Configure SMTP_HOST para passar a entregar.'
              }
              ajudaDesligada="Desligado, ninguém recebe e-mail de vagas. A busca continua rodando e as vagas continuam aparecendo na tela."
              ajudaSemChave=""
            />
            <Interruptor
              id="motor-ats"
              titulo="Buscar direto nos ATS"
              ligado={data.atsAtivo}
              // Sem dependência: as APIs de Greenhouse, Lever e Ashby são
              // públicas. É o único recurso aqui que não pede chave.
              temDependencia
              salvando={salvando}
              onAlternar={() => void alternar(api.definirAts, data.atsAtivo)}
              ajudaLigada="Consulta as vagas direto no sistema onde a empresa publica (Greenhouse, Lever, Ashby). É de graça, traz centenas de vagas e o salário vem do campo — mas não diz se a vaga aceita quem mora fora."
              ajudaDesligada="Desligado, a busca usa só o Firecrawl ou a IA — que custam e trazem menos vagas."
              ajudaSemChave=""
            />
            <EscolhaDeIa
              data={data}
              salvando={salvando}
              onEscolher={(ia) => void alternarIa(ia)}
            />
            <Interruptor
              id="leitura-cv"
              titulo="Ler currículo em PDF ou DOCX"
              ligado={data.leituraCvAtiva}
              temDependencia={data.temChaveDeIa}
              salvando={salvando}
              onAlternar={() =>
                void alternar(api.definirLeituraCv, data.leituraCvAtiva)
              }
              ajudaLigada="A pessoa pode subir o currículo e os filtros vêm preenchidos. O arquivo é enviado ao provedor de IA para ser lido e não fica guardado — só stack, senioridade e anos."
              ajudaSemChave="Cadastre uma chave da Anthropic acima para poder ligar. Sem ela o upload não funcionaria, e um interruptor ligado prometeria algo que falha na hora do uso."
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
        `${r.considerados} considerados · ${r.enviados} e-mails · ` +
          `${r.enviadosTelegram} telegram · ` +
          `${r.pulados} pulados · ${r.falhas} falhas` +
          (r.provedorEntrega ? '' : ` (provedor "${r.provedor}" nao entrega — so registrou no log)`) +
          (r.provedorTelegramEntrega ? '' : ' (Telegram desligado — so registrou no log)'),
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
        Notificações de vagas
      </h2>

      {loading && <LoadingState label="Carregando…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            Pessoas contratadas
          </p>
          <p
            className="text-4xl font-semibold"
            style={{ color: 'var(--accent-ink)' }}
          >
            {data.contratados}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Numero rotulo="Assinantes" valor={data.assinantes} />
            <Numero rotulo="Recebendo" valor={data.ativos} />
            <Numero rotulo="Uma por mês" valor={data.emCadenciaMensal} />
            <Numero rotulo="Já receberam" valor={data.jaReceberamAlgum} />
          </dl>

          {/* **A taxa de vinculação do Telegram** — o número que o JOB-32
              existe para produzir, e o que decide se vale investir mais no
              canal. Fica ao lado dos assinantes de propósito: é a comparação
              entre os dois canais que responde a pergunta. */}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Numero rotulo="Telegram vinculados" valor={data.telegramVinculados} />
            <Numero rotulo="Telegram recebendo" valor={data.telegramAtivos} />
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
              Sem servidor de e-mail configurado (provedor “{data.provedor}”):
              as mensagens são montadas e escritas no log da API, não enviadas.
            </p>
          )}

          <button
            type="button"
            onClick={() => void rodar()}
            disabled={rodando}
            className="mt-5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {rodando ? 'Rodando…' : 'Rodar agora'}
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
      <legend className="text-sm font-medium">IA que faz a busca</legend>
      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Usada quando o Firecrawl está desligado.
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
                <span style={{ color: 'var(--text-muted)' }}> — sem chave cadastrada</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {caiuNaOutra && (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Sem chave da escolhida, a busca está usando{' '}
          {data.iaEfetiva === 'openai' ? 'ChatGPT' : 'Claude'}.
        </p>
      )}
      {data.iaEfetiva === null && (
        <p className="mt-2 text-sm" style={{ color: WARN_INK }}>
          Nenhuma das duas tem chave. Com o Firecrawl desligado, a busca não
          tem como rodar.
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
            ? 'Telegram desligado — como ligar'
            : vinculados === 0
              ? 'Telegram configurado — ninguém conectado ainda'
              : 'Telegram — como configurar ou trocar o bot'}
        </span>
        <span aria-hidden style={{ color: 'var(--text-muted)' }}>
          {aberto ? '▴' : '▾'}
        </span>
      </button>

      <Recolhivel aberto={aberto} id={id}>
        <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border)' }}>
          <p className={passo} style={{ color: 'var(--text-muted)' }}>
            {!ligado
              ? 'Enquanto está desligado, a opção não aparece na aba Jobs e nada é enviado por lá. São quatro passos, e nenhum custa dinheiro.'
              : 'Token presente não é token que funciona: se o log da API mostrar 401 ao enviar, ele é inválido — refaça o passo 1. Os passos também servem para trocar o bot ou refazer o túnel.'}
          </p>

          <ol className="mt-3 flex flex-col gap-3">
            <li className="text-sm leading-relaxed">
              <strong>1. Crie o bot.</strong> No Telegram, fale com{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: 'var(--brand)' }}
              >
                @BotFather
              </a>{' '}
              e envie <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>/newbot</code>.
              Ele pede um nome e um username terminado em <em>bot</em>, e
              devolve um token parecido com{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>
                8123456789:AAH…
              </code>
            </li>

            <li className="text-sm leading-relaxed">
              <strong>2. Guarde o token no servidor.</strong> Em{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>.env</code>:
              <pre
                className="mt-2 overflow-x-auto rounded-md p-3 text-xs"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text)' }}
              >{`TELEGRAM_BOT_TOKEN=8123456789:AAH…
TELEGRAM_BOT_USERNAME=seu_bot
TELEGRAM_WEBHOOK_SECRET=uma-frase-longa-e-aleatoria`}</pre>
              <span style={{ color: 'var(--text-muted)' }}>
                O segredo é o que faz o webhook recusar quem não é o Telegram —
                sem ele, qualquer um poderia forjar mensagens.
              </span>
            </li>

            <li className="text-sm leading-relaxed">
              <strong>3. Dê ao Telegram um endereço público.</strong> Ele só
              entrega em HTTPS, e não alcança <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>localhost</code>.
              Em produção é a URL do site; em desenvolvimento, um túnel:
              <pre
                className="mt-2 overflow-x-auto rounded-md p-3 text-xs"
                style={{ background: 'var(--surface-sunken)', color: 'var(--text)' }}
              >{`# num terminal separado
npx localtunnel --port 3333

TELEGRAM_WEBHOOK_URL=https://o-que-ele-devolveu/api/telegram/webhook`}</pre>
              <span style={{ color: 'var(--text-muted)' }}>
                A API registra o webhook sozinha ao subir, e avisa no log se o
                Telegram recusar.
              </span>
            </li>

            <li className="text-sm leading-relaxed">
              <strong>4. Reinicie e conecte.</strong>{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>
                docker compose up -d --build api
              </code>
              , volte à aba Jobs e clique em <em>Connect Telegram</em>. O bot
              não consegue iniciar conversa — é você que precisa mandar o{' '}
              <code className={codigo} style={{ background: 'var(--surface-sunken)' }}>/start</code>,
              e o botão faz isso pelo link.
            </li>
          </ol>

          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Por que Telegram e não
            e-mail:</strong>{' '}
            os planos gratuitos de envio (Resend, Brevo) exigem domínio próprio
            com DKIM, SPF e DMARC — comprar domínio, configurar DNS e esperar
            propagação antes da primeira mensagem sair. O Telegram entrega com o
            token acima, sem domínio e sem custo.
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
