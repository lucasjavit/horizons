import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { BotaoDeCopiar } from '../components/settings/BotaoDeCopiar'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type {
  CustoDeRotacao,
  EstadoDoSegredo,
  Prontidao,
  SegredoDeDeploy,
} from '../types/api'

/**
 * O que cada segredo é, e o que acontece se faltar.
 *
 * Fica no front, e não no DTO, pela mesma razão que o `ONDE` da página de
 * provedores: é texto de interface. O backend responde o ESTADO (presente,
 * curto, ausente), que só ele sabe; a explicação é a mesma em qualquer
 * instalação e não precisa cruzar a rede a cada carga.
 *
 * `comando` é código e fica em inglês-neutro por ser código — a regra do
 * idioma vale para a prosa em volta.
 */
const EXPLICACAO: Record<
  string,
  {
    titulo: string
    oQueE: string
    /** O rótulo acima do bloco de comando. Nem todo valor se "gera". */
    comoRotulo: string
    comando: string
    seFaltar: string
  }
> = {
  POSTGRES_PASSWORD: {
    comoRotulo: 'How to generate it',
    titulo: 'Database password',
    oQueE:
      'The password Postgres starts with. The compose builds DATABASE_URL from it, so this one variable reaches both the database and the API. The status here is read back from that connection string, which is where the API actually receives it.',
    comando: 'openssl rand -base64 24 | tr -d "/@"',
    seFaltar:
      'The compose refuses to start. Leaving the development password (horizons) is worse than leaving it empty: it is written in docker-compose.yml, in a public repository.',
  },
  JWT_SECRET: {
    comoRotulo: 'How to generate it',
    titulo: 'Session signing key',
    oQueE:
      'Signs the session token that keeps people logged in for 30 days. It never leaves the server.',
    comando: 'openssl rand -base64 32',
    seFaltar:
      'The API does not boot at all, and restarts in a loop. That is deliberate: a server misconfiguration is not an authentication error, and answering 401 would hide the real problem behind a login screen.',
  },
  ENCRYPTION_KEY: {
    comoRotulo: 'How to generate it',
    titulo: 'Encryption key for stored API keys',
    oQueE:
      'Encrypts the AI provider keys saved under AI providers, with AES-256-GCM. The key is run through scrypt first, so a long passphrase works as well as random bytes.',
    comando: 'openssl rand -base64 32',
    seFaltar:
      'The application boots, and then fails the moment someone saves or reads a provider key. Missing it is not caught at startup, so it surfaces later, as a broken feature rather than a clear error.',
  },
  CORS_ORIGIN: {
    // Nao se gera um dominio: mostra-se o formato esperado.
    comoRotulo: 'The format it expects',
    titulo: 'Public origin',
    oQueE:
      'The address the frontend is served from, with https:// and no trailing slash. Not a secret — it is here because the compose refuses to start without it.',
    comando: 'https://horizons.yourdomain.com',
    seFaltar:
      'The compose refuses to start. Set to the wrong domain it falls back to blocking cross-origin calls; the app itself keeps working, because nginx proxies /api on the same host.',
  },
}

/** O que muda se a pessoa trocar o valor depois. */
const ROTACAO: Record<CustoDeRotacao, { rotulo: string; texto: string; grave: boolean }> = {
  seguro: {
    rotulo: 'Safe to change',
    texto: 'Change it whenever the domain changes. Nothing is lost.',
    grave: false,
  },
  desloga: {
    rotulo: 'Safe to rotate — logs everyone out',
    texto:
      'Every open session stops validating and people sign in again. Nothing is destroyed, so rotate it freely if you suspect it leaked.',
    grave: false,
  },
  destrutivo: {
    rotulo: 'Cannot be changed later',
    texto:
      'Every AI provider key already saved was encrypted with this value and becomes unreadable — decryption fails outright, it does not return garbage. Rotating means typing every provider key in again afterwards. Keep it in a password manager, not only in the deploy panel.',
    grave: true,
  },
  coordenado: {
    rotulo: 'Change in two places at once',
    texto:
      'Postgres stores the password it was first initialised with, in its volume. Changing this variable alone leaves the API unable to connect: change it in the database too, or the volume is recreated and the data goes with it.',
    grave: true,
  },
}

/**
 * Going live: o que precisa estar pronto antes de publicar.
 *
 * **É uma quinta aba, e não uma seção em Features.** Features é decisão de
 * produto em tempo de execução — interruptores que o admin liga e desliga
 * enquanto a aplicação roda. Isto é o contrário: leitura, sem nenhum controle,
 * sobre o ambiente onde o processo subiu, e nada aqui muda pela tela. Enfiar no
 * fim de Features somaria ~900px de rolagem a uma página de interruptores, e
 * esconderia atrás do rótulo errado justamente o aviso de AUTH_DISABLED — que é
 * o item mais urgente da tela inteira.
 *
 * **Ela não gera segredo, e isso é a decisão de desenho.** Um botão "generate"
 * que devolvesse o valor na tela criaria um caminho novo de vazamento (log do
 * servidor, HTML, histórico da aba) para substituir um comando de uma linha. E
 * na ENCRYPTION_KEY um clique acidental tornaria ilegível toda chave de IA já
 * cadastrada. A tela ensina o comando; quem executa é a pessoa, no servidor.
 */
export function ConfigDeployPage() {
  useDocumentTitle('Going live — Settings')

  const { data, loading, error, reload } = useAsync(
    (signal) => api.prontidao(signal),
    [],
  )

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <AbasDeConfig />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Going live
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          What production needs before you publish, and what this server has
          right now. Values are never shown here — only whether each one is set.
        </p>
      </header>

      {loading && <LoadingState label="Checking this server…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <Resumo data={data} />
          <EstadoDoAcesso data={data} />

          <section className="mt-10">
            <h2 className="text-lg font-semibold">The four required secrets</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              docker-compose.prod.yml declares each of these as{' '}
              <code className="text-[13px]">{'${VAR:?}'}</code>: with any one
              missing, the compose refuses to start rather than booting a server
              that is half configured. Generate each on the machine you deploy
              from, then paste it into the deploy panel.
            </p>

            <ul className="mt-5 space-y-4">
              {data.segredos.map((s) => (
                <CartaoDeSegredo key={s.nome} segredo={s} />
              ))}
            </ul>
          </section>

          <div className="mt-10 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-base font-semibold">The full deploy guide</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              This page is the checklist. The Coolify setup, the Google OAuth
              origins, the curl commands that verify a deploy from outside, and
              what each failure looks like are in{' '}
              <code className="text-[13px]">docs/DEPLOY.md</code> in the
              repository.
            </p>
          </div>
        </>
      )}
    </main>
  )
}

/**
 * O veredito, no topo.
 *
 * Copiado do painel de saúde de AI providers, e pela mesma razão: a pergunta
 * com que se chega nesta tela é "posso publicar?". Uma lista de itens obriga a
 * pessoa a somar o resultado de cabeça.
 */
function Resumo({ data }: { data: Prontidao }) {
  const faltando = data.segredos.filter((s) => s.estado !== 'ok')
  const cor = data.pronto ? 'var(--brand)' : WARN_INK

  const titulo = data.pronto
    ? 'This server is configured to run in production.'
    : data.login.authDisabled
      ? 'Login is off. This server must not be published as it is.'
      : faltando.length > 0
        ? `${faltando.length} of 4 secrets ${faltando.length === 1 ? 'is' : 'are'} missing or too weak.`
        : 'Secrets are set, but nobody could administer this server.'

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: cor }}
        />
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: cor }}>
            {titulo}
          </p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Read from the environment this API process actually received — not
            from a file on disk. A variable changed in the deploy panel only
            counts after a redeploy.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * O estado do acesso.
 *
 * `AUTH_DISABLED` vem primeiro e sozinho quando está ligado. Não é um item
 * entre outros: com ela ligada nenhuma rota exige token, e
 * `GET /api/settings/tokens` — as chaves de IA — responde a quem alcançar a
 * porta. Os outros dois itens são sobre conveniência; este é sobre a aplicação
 * estar aberta.
 */
function EstadoDoAcesso({ data }: { data: Prontidao }) {
  const { authDisabled, googleConfigurado, admins } = data.login

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Who can get in</h2>

      {authDisabled && (
        <div
          className="mt-3 rounded-lg border border-l-4 p-4"
          style={{
            borderColor: 'var(--border)',
            borderLeftColor: WARN_INK,
            background: 'var(--surface-sunken)',
          }}
        >
          <p className="font-semibold" style={{ color: WARN_INK }}>
            AUTH_DISABLED is on. Every route is open.
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            No route requires a token, and everyone resolves to the same
            account. That includes{' '}
            <code className="text-[13px]">GET /api/settings/tokens</code>, where
            the AI provider keys live: they are encrypted against a database
            leak, not against a request that arrives authorised. Anyone who
            reaches this port reads them.
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Remove the variable and redeploy. The production compose does not
            define it, and the default in code is off — so a fresh deploy is
            closed unless someone adds it back.
          </p>
        </div>
      )}

      <ul className="mt-3 space-y-3">
        {!authDisabled && (
          <ItemDeAcesso
            ok
            titulo="Login is required"
            texto="AUTH_DISABLED is off, so every private route needs a token. This is the default in both compose files: forgetting the variable closes access, it never opens it."
          />
        )}
        <ItemDeAcesso
          ok={googleConfigurado}
          titulo={
            googleConfigurado
              ? 'GOOGLE_CLIENT_ID is set'
              : 'GOOGLE_CLIENT_ID is missing — nobody can sign in'
          }
          texto={
            googleConfigurado
              ? 'The Client ID is public by design; it appears in the HTML of any site using Google Sign-In. Its origin still has to be registered in Google Cloud Console, and that is not visible from here.'
              : 'The application boots anyway and the login screen explains it is not configured, rather than showing a button that fails. Create an OAuth 2.0 Client ID of type Web application and register the public origin with https://.'
          }
        />
        <ItemDeAcesso
          ok={admins > 0}
          titulo={
            admins > 0
              ? `ADMIN_EMAILS lists ${admins} ${admins === 1 ? 'address' : 'addresses'}`
              : 'ADMIN_EMAILS is empty — nobody is an administrator'
          }
          texto={
            admins > 0
              ? 'The role is re-evaluated from this variable at every login. Removing an address takes effect the next time that person signs in.'
              : 'Without an administrator there is no gear icon and no Settings — including this page and the AI provider keys. Promoting someone directly in the database does not survive their next login: the variable is the source of truth.'
          }
        />
      </ul>
    </section>
  )
}

function ItemDeAcesso({
  ok,
  titulo,
  texto,
}: {
  ok: boolean
  titulo: string
  texto: string
}) {
  return (
    <li
      className="rounded-lg border p-3.5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: ok ? 'var(--brand)' : WARN_INK }}
        />
        <div className="min-w-0">
          {/* O estado está no TEXTO do título, não só na bolinha. */}
          <p className="text-sm font-semibold" style={{ color: ok ? undefined : WARN_INK }}>
            {titulo}
          </p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {texto}
          </p>
        </div>
      </div>
    </li>
  )
}

function CartaoDeSegredo({ segredo }: { segredo: SegredoDeDeploy }) {
  const info = EXPLICACAO[segredo.nome]
  const rot = ROTACAO[segredo.rotacao]

  return (
    <li
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{info?.titulo ?? segredo.nome}</h3>
          <code className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {segredo.nome}
          </code>
        </div>
        <SeloDeSegredo estado={segredo.estado} tamanho={segredo.tamanho} />
      </div>

      {info && (
        <>
          <p className="mt-3 text-sm leading-relaxed">{info.oQueE}</p>

          <div className="mt-3">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {info.comoRotulo}
            </p>
            <BotaoDeCopiar texto={info.comando} rotulo={`${segredo.nome} command`} />
          </div>

          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>
              If it is missing:{' '}
            </span>
            {info.seFaltar}
          </p>
        </>
      )}

      <p
        className="mt-3 border-t pt-3 text-sm leading-relaxed"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <span
          className="font-semibold"
          style={{ color: rot.grave ? WARN_INK : 'var(--text)' }}
        >
          {rot.rotulo}.{' '}
        </span>
        {rot.texto}
      </p>
    </li>
  )
}

/**
 * O selo de estado do segredo.
 *
 * Mostra o COMPRIMENTO e nunca o valor — nem um prefixo, nem os últimos
 * caracteres. Comprimento responde "a variável chegou inteira?" (uma
 * JWT_SECRET de 8 caracteres é um boot que não acontece) sem revelar nada.
 */
function SeloDeSegredo({
  estado,
  tamanho,
}: {
  estado: EstadoDoSegredo
  tamanho: number
}) {
  const { rotulo, cor } =
    estado === 'ok'
      ? { rotulo: `Set · ${tamanho} chars`, cor: 'var(--brand)' }
      : estado === 'invalido'
        ? { rotulo: `Too weak · ${tamanho} chars`, cor: WARN_INK }
        : { rotulo: 'Not set', cor: WARN_INK }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: cor, borderColor: cor }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {rotulo}
    </span>
  )
}
