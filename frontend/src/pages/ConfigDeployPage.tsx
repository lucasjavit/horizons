import { useId, useState, type ReactNode } from 'react'
import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { BotaoDeCopiar } from '../components/settings/BotaoDeCopiar'
import { Recolhivel } from '../components/Recolhivel'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type {
  CustoDeRotacao,
  EstadoDoPasso,
  EstadoDoSegredo,
  PassoDeDeploy,
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

/**
 * O texto de cada passo de publicar, na ordem de execução.
 *
 * **Fica no front pela mesma razão que `EXPLICACAO`:** é texto de interface,
 * igual em qualquer instalação. O backend responde só o `estado` de cada `id`,
 * que é o que só ele pode saber. Mandar a prosa pelo DTO criaria uma segunda
 * cópia para divergir da primeira.
 *
 * **O que entrou aqui, e o que ficou no `docs/DEPLOY.md`:** entra o que se faz
 * com esta tela aberta. Fica no arquivo a referência longa e o diagnóstico de
 * caso raro — um container em loop de reinício não é lido nesta página, porque
 * nesse estado esta página não carrega.
 */
const PASSOS: Record<
  string,
  { titulo: string; resumo: string; detalhe: ReactNode }
> = {
  recurso: {
    titulo: 'Create the resource in Coolify',
    resumo: 'Docker Compose, pointed at docker-compose.prod.yml.',
    detalhe: (
      <>
        <p>
          <strong>+ New → Docker Compose</strong> — not Dockerfile, not Nixpacks:
          the build is several services. Point Source at the repository and the
          branch you want to publish.
        </p>
        <p>
          <strong>Set Docker Compose Location to</strong>{' '}
          <code>docker-compose.prod.yml</code>. The field arrives pre-filled with{' '}
          <code>docker-compose.yml</code>, which is the development one: it
          publishes ports 5433, 3333 and 5173 on the host, uses a fixed database
          password, and builds the internal backlog tab into the site.
        </p>
        <p>
          Point the domain at the <strong>web</strong> service, not the API. It
          is the frontend nginx that serves the page and proxies{' '}
          <code>/api</code> onward — the API never gets a domain of its own.
        </p>
        <p style={{ color: 'var(--text-muted)' }}>
          Do not deploy yet. Set the variables first, or you will be debugging a
          container that restarts in a loop.
        </p>
      </>
    ),
  },
  segredos: {
    titulo: 'Set the four secrets',
    resumo: 'Generate each one and paste it into the deploy panel.',
    detalhe: (
      <p>
        They are listed above, with the command that generates each one and what
        it costs to change it later. The production compose declares all four as{' '}
        <code>{'${VAR:?}'}</code>: with any one missing it refuses to start,
        rather than booting a half-configured server.
      </p>
    ),
  },
  admins: {
    titulo: 'Put yourself in ADMIN_EMAILS',
    resumo: 'Empty means nobody can reach Settings — including this page.',
    detalhe: (
      <p>
        Comma-separated addresses. The role is re-evaluated from this variable at
        every login, so promoting someone directly in the database does not
        survive their next sign-in. Get this wrong and the deploy succeeds, but
        nobody can open Settings to fix anything — including the AI provider
        keys.
      </p>
    ),
  },
  tls: {
    titulo: 'Turn on HTTPS, and confirm the certificate is real',
    resumo: 'Do this before registering the origin with Google.',
    detalhe: (
      <>
        <p>
          Enable Let's Encrypt on the <strong>web</strong> service. Then check
          the certificate from your own machine — port 443 answering is not the
          same as TLS working:
        </p>
        <CopiaDeComando
          rotulo="certificate check"
          comando="echo | openssl s_client -connect YOUR-DOMAIN:443 -servername YOUR-DOMAIN 2>/dev/null | grep issuer="
        />
        <p>
          <code>issuer=C=US, O=Let's Encrypt</code> is what you want.{' '}
          <code>issuer=CN=TRAEFIK DEFAULT CERT</code> means the proxy is
          answering with its own placeholder and no real certificate was ever
          issued — usually because the Domains field is written with{' '}
          <code>http://</code>, which is the scheme Coolify reads to decide
          whether to request one at all.
        </p>
      </>
    ),
  },
  google: {
    titulo: 'Register the origin in Google Cloud Console',
    resumo: 'The button rendering does not mean the origin is registered.',
    detalhe: (
      <>
        <p>
          <strong>APIs &amp; Services → Credentials → your OAuth 2.0 Client
          ID</strong> (type <em>Web application</em>). Under{' '}
          <strong>Authorized JavaScript origins</strong>, add the public origin
          with <code>https://</code>, no trailing slash, no path. Leave{' '}
          <strong>Authorized redirect URIs</strong> empty: this flow returns an
          ID token straight to the browser, so nothing redirects.
        </p>
        <p>
          <strong style={{ color: 'var(--text)' }}>
            Google rejects most non-HTTPS origins, and the error does not say
            so.
          </strong>{' '}
          Origins must use HTTPS, and hosts cannot be raw IP addresses —{' '}
          <em>localhost is the exception to both</em>. So{' '}
          <code>http://localhost:5173</code> is accepted, while{' '}
          <code>http://192.168.1.10:5173</code> is refused at registration time,
          and production needs a real certificate first. Testing over your
          machine's LAN address is the common way to hit this.
        </p>
        <p>
          The symptom does not suggest the cause: the Google button{' '}
          <strong>appears normally</strong> and only fails when someone clicks,
          with <code>The given client ID is not found</code> or{' '}
          <code>[GSI_LOGGER]: The given origin is not allowed</code> in the
          browser console. Google only validates the origin at that moment.
        </p>
        <p style={{ color: 'var(--text-muted)' }}>
          The Client Secret is not used anywhere. The Client ID is public by
          design — it appears in the HTML of every site using Google Sign-In.
        </p>
      </>
    ),
  },
  cors: {
    titulo: 'Point CORS_ORIGIN at the public domain',
    resumo: 'Same https:// address you registered with Google.',
    detalhe: (
      <p>
        A variable changed in the panel only takes effect in a new container, so
        redeploy after setting it. Left at the default, the app still works —
        nginx proxies <code>/api</code> on the same host, so there is no
        cross-origin request in normal use — but any call from elsewhere is
        blocked, and that is a confusing thing to debug later.
      </p>
    ),
  },
  login: {
    titulo: 'Leave AUTH_DISABLED unset',
    resumo: 'The default is off in both compose files. Keep it that way.',
    detalhe: (
      <p>
        Forgetting this variable closes access; it never opens it. Setting it to
        true is not "skip the login screen" — it stops every route from
        requiring a token, including{' '}
        <code>GET /api/settings/tokens</code>, where the AI provider keys live.
        They are encrypted against a database leak, not against a request that
        arrives authorised.
      </p>
    ),
  },
  quadro: {
    titulo: 'Confirm the internal backlog did not ship',
    resumo: 'It is a frontend build flag, so this page cannot see it.',
    detalhe: (
      <>
        <p>
          The Quadro tab exposes the internal backlog — known bugs and product
          decisions. It is excluded unless <code>VITE_QUADRO</code> is set at
          build time, but hiding the tab is not the same as removing the data:{' '}
          <code>quadro.json</code> is a static file, and the Dockerfile deletes
          it separately. Check the file, not the tab:
        </p>
        <CopiaDeComando
          rotulo="backlog check"
          comando="curl -s -o /dev/null -w '%{http_code}\n' https://YOUR-DOMAIN/quadro.json"
        />
        <p>
          <strong>404 is the pass.</strong> A 200 with JSON means the build went
          out with the flag on and the backlog is public.
        </p>
      </>
    ),
  },
  verificar: {
    titulo: 'Verify from outside, over the real domain',
    resumo: 'The panel saying "deployment successful" is not the criterion.',
    detalhe: (
      <>
        <p>
          Run these from your own machine, so the request crosses the proxy the
          way a visitor's does. From inside the container they always pass,
          which is exactly why they are worth running.
        </p>
        <CopiaDeComando
          rotulo="public config check"
          comando="curl -s https://YOUR-DOMAIN/api/auth/config"
        />
        <p>
          Expect <code>"enabled":true</code> and{' '}
          <code>"authDisabled":false</code>.{' '}
          <code>"enabled":false</code> means <code>GOOGLE_CLIENT_ID</code> never
          reached the container and nobody can sign in.
        </p>
        <CopiaDeComando
          rotulo="private route check"
          comando={
            'for r in auth/me settings/tokens; do printf "%s -> " "$r"; ' +
            'curl -s -o /dev/null -w "%{http_code}\\n" "https://YOUR-DOMAIN/api/$r"; done'
          }
        />
        <p>
          <strong style={{ color: WARN_INK }}>
            Both must answer 401. A 200 here is a security failure, not a
            success
          </strong>{' '}
          — it means login is off and the AI provider keys are readable by
          anyone with the URL. Remove <code>AUTH_DISABLED</code>, redeploy, and
          repeat until both give 401.
        </p>
        <p>
          Reading tracks anonymously is public on purpose, so{' '}
          <code>/api/tracks</code> answering 200 is correct. What proves login
          is on is the 401 above, not that route.
        </p>
        <p style={{ color: 'var(--text-muted)' }}>
          Then open the domain in a browser, sign in with Google, and confirm
          that marking a lesson complete works — in both themes.
        </p>
      </>
    ),
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
 * Deploy Prod: o que precisa estar pronto antes de publicar.
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
  useDocumentTitle('Deploy Prod — Settings')

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
          Deploy Prod
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

          <GuiaDePublicar data={data} />

          <div className="mt-10 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-base font-semibold">When something breaks</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              The steps above are what you do to publish. Diagnosing a deploy
              that failed —{' '}
              <code className="text-[13px]">api</code> stuck unhealthy, the API
              restarting in a loop, migrations that did not run — is in{' '}
              <code className="text-[13px]">docs/DEPLOY.md</code> in the
              repository, because in most of those states this page is not
              loading either.
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

/**
 * Um comando copiavel dentro do texto de um passo.
 *
 * Wrapper fino sobre `BotaoDeCopiar` so para o espacamento vertical no meio de
 * uma prosa — o botao nasceu encostado no rotulo dos segredos.
 */
function CopiaDeComando({ comando, rotulo }: { comando: string; rotulo: string }) {
  return (
    <span className="mt-1 block">
      <BotaoDeCopiar texto={comando} rotulo={rotulo} />
    </span>
  )
}

/**
 * O guia de publicar, em passos numerados.
 *
 * **Recolhido por padrão, e recolhível por passo.** A página já tinha ~2.760px
 * antes disto; o guia inteiro aberto a dobrava, e empurrava para fora da tela
 * justamente o alarme de AUTH_DISABLED e o veredito — que são o que alguém
 * abre esta página para ver. Fechado, ele custa uma linha.
 *
 * Aberto, cada passo mostra só o título, o estado e uma linha de resumo: a
 * sequência inteira se lê de uma vez, e o detalhe só aparece no passo em que a
 * pessoa está. Vários podem ficar abertos ao mesmo tempo — um acordeão que
 * fecha o anterior atrapalharia quem compara dois passos.
 */
function GuiaDePublicar({ data }: { data: Prontidao }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()

  const feitos = data.passos.filter((p) => p.estado === 'cumprido').length
  const verificaveis = data.passos.filter((p) => p.estado !== 'manual').length

  return (
    <section className="mt-10">
      <div
        className="rounded-xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={id}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
          style={{ color: 'var(--text)' }}
        >
          <span className="min-w-0">
            <span className="block font-semibold">
              How to publish, step by step
            </span>
            <span className="mt-0.5 block text-sm" style={{ color: 'var(--text-muted)' }}>
              {data.passos.length} steps in the order you run them —{' '}
              {feitos} of the {verificaveis} this server can check{' '}
              {feitos === 1 ? 'is' : 'are'} already done.
            </span>
          </span>
          <span aria-hidden className="shrink-0" style={{ color: 'var(--text-muted)' }}>
            {aberto ? '▴' : '▾'}
          </span>
        </button>

        <Recolhivel aberto={aberto} id={id}>
          <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border)' }}>
            {data.ambienteDeDesenvolvimento && (
              <p
                className="mt-4 rounded-lg border border-l-4 p-3 text-sm leading-relaxed"
                style={{
                  borderColor: 'var(--border)',
                  borderLeftColor: WARN_INK,
                  background: 'var(--surface-sunken)',
                }}
              >
                <strong style={{ color: WARN_INK }}>
                  This is not the production server.
                </strong>{' '}
                This page reads the process it is running in, and this one still
                has development values — the public database password, or a
                localhost origin. The states below describe this machine, so a
                step marked done here says nothing about your deployed server.
                Open this page on the deployed domain to check that one.
              </p>
            )}

            <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Four of these end in something outside this process — the Google
              Cloud Console, the proxy's certificate, the frontend build, a
              request arriving from the internet. Those are marked{' '}
              <em>you confirm this</em>: the page cannot see them, and saying
              otherwise would be guessing.
            </p>

            <ol className="mt-4 flex flex-col gap-2.5">
              {data.passos.map((passo, i) => (
                <PassoDoGuia key={passo.id} passo={passo} numero={i + 1} />
              ))}
            </ol>
          </div>
        </Recolhivel>
      </div>
    </section>
  )
}

/** Um passo: cabeçalho sempre visível, detalhe atrás do próprio botão. */
function PassoDoGuia({ passo, numero }: { passo: PassoDeDeploy; numero: number }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  const texto = PASSOS[passo.id]

  if (!texto) return null

  return (
    <li
      className="rounded-lg border"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        className="flex min-h-11 w-full items-start gap-3 px-3.5 py-3 text-left"
        style={{ color: 'var(--text)' }}
      >
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-sm font-semibold tabular-nums"
          style={{ color: 'var(--text-muted)' }}
        >
          {numero}.
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{texto.titulo}</span>
            <SeloDePasso estado={passo.estado} />
          </span>
          <span className="mt-1 block text-sm" style={{ color: 'var(--text-muted)' }}>
            {texto.resumo}
          </span>
        </span>
        <span aria-hidden className="shrink-0" style={{ color: 'var(--text-muted)' }}>
          {aberto ? '▴' : '▾'}
        </span>
      </button>

      <Recolhivel aberto={aberto} id={id}>
        {/* `[&>p]` em vez de repetir a classe em cada <p> do texto do passo:
            o conteúdo é ReactNode escrito à mão, não uma lista de strings. */}
        <div
          className="border-t px-3.5 py-3 text-sm leading-relaxed [&>p]:mt-2.5 [&>p:first-child]:mt-0"
          style={{ borderColor: 'var(--border)' }}
        >
          {texto.detalhe}
        </div>
      </Recolhivel>
    </li>
  )
}

/**
 * O estado de um passo.
 *
 * `manual` é cinza e não verde nem vermelho de propósito: não é uma pendência
 * que um redeploy resolve, nem algo que a página conferiu. É "a prova está do
 * lado de fora" — e pintá-lo como qualquer um dos outros dois seria mentir em
 * uma das duas direções.
 */
function SeloDePasso({ estado }: { estado: EstadoDoPasso }) {
  const { rotulo, cor } =
    estado === 'cumprido'
      ? { rotulo: 'Done on this server', cor: 'var(--brand)' }
      : estado === 'pendente'
        ? { rotulo: 'Not done yet', cor: WARN_INK }
        : { rotulo: 'You confirm this', cor: 'var(--text-muted)' }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{ color: cor, borderColor: cor }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {rotulo}
    </span>
  )
}
