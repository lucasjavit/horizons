import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type {
  ApiProvider,
  ProvedorIa,
  Recursos,
  StatusDaChave,
} from '../types/api'

/**
 * Onde se cria a chave de cada provedor, e com o que ela começa.
 *
 * O backend já manda `console` (o caminho em texto), mas não a URL nem o
 * prefixo — são fatos de interface, e não do domínio da cadeia. Ficam aqui
 * para o link ser clicável e o `placeholder` reconhecível.
 */
const ONDE: Record<string, { url: string; prefixo: string }> = {
  ANTHROPIC: { url: 'https://console.anthropic.com/settings/keys', prefixo: 'sk-ant-' },
  OPENAI: { url: 'https://platform.openai.com/api-keys', prefixo: 'sk-' },
  GEMINI: { url: 'https://aistudio.google.com/apikey', prefixo: 'AIza' },
  GROQ: { url: 'https://console.groq.com/keys', prefixo: 'gsk_' },
  CEREBRAS: { url: 'https://cloud.cerebras.ai', prefixo: 'csk-' },
  MISTRAL: { url: 'https://console.mistral.ai/api-keys', prefixo: '' },
}

/**
 * Configuração dos provedores de IA.
 *
 * **A página responde primeiro a pergunta com que se chega nela:** o que
 * funciona agora, e o que não funciona. Por isso o painel de saúde vem antes
 * de qualquer cartão — a tela antiga mostrava "stored" para duas chaves
 * mortas, e quem abria para descobrir por que a busca não achava vaga saía
 * sem a resposta.
 *
 * Duas cadeias, porque os dois usos exigem coisas diferentes: a busca precisa
 * de busca na web (3 provedores), a leitura só de saída estruturada (6).
 */
export function ConfigIaPage() {
  useDocumentTitle('AI providers — Settings')

  const { data, loading, error, reload, setData } = useAsync(
    (signal) => api.recursos(signal),
    [],
  )
  // Erro de mutação num useState separado do erro do useAsync: um 400 ao mover
  // um provedor não pode apagar a página inteira e mostrar "try again".
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)
  // O que a região aria-live anuncia. Vazio fora de uma ação.
  const [anuncio, setAnuncio] = useState('')

  /**
   * Depois de mover, o foco tem de acompanhar a linha que se moveu.
   *
   * Sem isto, quem usa teclado clica ↓, a lista se reordena, o botão sai de
   * baixo do foco e a navegação volta para o `<body>` — a pessoa perde o
   * lugar exatamente na ação que exige repetição. (Medido: `activeElement`
   * virava BODY depois do clique.)
   *
   * **Por que reencontrar o botão pelo seletor, e não um `ref`:** as linhas
   * têm `key={provedor.id}`, então ao reordenar o React MOVE os nós existentes
   * em vez de recriá-los — o callback de `ref` não dispara, e um `ref` guardado
   * apontaria para o botão certo mas antes de o React reposicioná-lo. Procurar
   * pelo `aria-label` depois do commit funciona nos dois casos.
   */
  const focoPendente = useRef<string | null>(null)

  /**
   * Devolve o foco ao botão que a pessoa acabou de usar, após o commit.
   *
   * **Cai para a seta irmã quando a usada fica desabilitada.** Mover uma linha
   * para a ponta desabilita justamente a seta que a levou lá — e um botão
   * `disabled` não aceita foco, então o foco cairia no `<body>` e a pessoa
   * perderia o lugar exatamente no fim do percurso. (Medido: `activeElement`
   * virava BODY ao mover o segundo item para o topo.) A seta oposta está na
   * mesma linha e continua ativa, então é ela que recebe o foco.
   */
  const restaurarFoco = useCallback(() => {
    const alvo = focoPendente.current
    if (!alvo) return
    focoPendente.current = null
    // **Dois `requestAnimationFrame`, e não um.**
    //
    // Medido pelo QA em 25/08: o foco ia para o `<body>` em 9 de 10 tentativas
    // ao mover uma linha para a ponta. O primeiro `rAF` roda ANTES do commit do
    // React que aplica `disabled`, então a seta usada ainda estava habilitada,
    // o `el.focus()` tinha sucesso, o `return` pulava o fallback — e só depois
    // o navegador expulsava o foco do botão recém-desabilitado. O rastro de
    // eventos mostrava a ordem: FOCUSIN, FOCUSOUT para BODY, e só então
    // `disabled=true`.
    //
    // O segundo quadro roda depois do commit, quando `disabled` já reflete a
    // nova posição — e aí a checagem volta a significar o que promete.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const busca = (chave: string) =>
          document.querySelector<HTMLButtonElement>(
            `button[data-foco="${CSS.escape(chave)}"]`,
          )
        const el = busca(alvo)
        if (el && !el.disabled) {
          el.focus()
          return
        }
        const irma = alvo.endsWith(':cima')
          ? alvo.replace(/:cima$/, ':baixo')
          : alvo.replace(/:baixo$/, ':cima')
        const outra = busca(irma)
        if (outra && !outra.disabled) outra.focus()
      })
    })
  }, [])

  const mover = useCallback(
    async (
      p: ProvedorIa,
      direcao: 'cima' | 'baixo',
      chaveDoFoco: string,
      cadeia: 'estruturada' | 'buscaWeb',
    ) => {
      setErroAcao(null)
      focoPendente.current = chaveDoFoco
      try {
        const novo = await api.moverProvedor(p.id, direcao, cadeia)
        setData(novo)
        restaurarFoco()
        // A posição anunciada é a da CADEIA que a pessoa está vendo, não a da
        // lista completa: "position 2 of 3" é o que está na tela.
        const visiveis =
          cadeia === 'buscaWeb'
            ? novo.provedores.filter((x) => x.buscaWeb)
            : novo.provedores
        const pos = visiveis.findIndex((x) => x.id === p.id) + 1
        // Anuncia a NOVA POSIÇÃO, não "moved": a informação que se perde ao
        // não ver a tela é onde a linha foi parar.
        setAnuncio(`${p.nome} moved to position ${pos} of ${visiveis.length}.`)
      } catch (e) {
        setErroAcao(errorMessage(e))
        setAnuncio('')
      }
    },
    [setData, restaurarFoco],
  )

  const verificarTudo = useCallback(async () => {
    setErroAcao(null)
    setVerificando(true)
    setAnuncio('Testing all keys…')
    try {
      const novo = await api.verificarChaves()
      setData(novo)
      const ok = novo.provedores.filter((p) => p.status === 'funcionando').length
      setAnuncio(`Test finished. ${ok} of ${novo.provedores.length} providers working.`)
    } catch (e) {
      setErroAcao(errorMessage(e))
      setAnuncio('')
    } finally {
      setVerificando(false)
    }
  }, [setData])

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <AbasDeConfig />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          AI providers
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          The application tries these in order until one answers. Add a key to
          any of them — you do not need all six.
        </p>
      </header>

      {/* Uma região só para as duas ações da página. `polite` para não
          interromper o que o leitor de tela estiver dizendo. */}
      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {loading && <LoadingState label="Loading providers…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <PainelDeSaude data={data} verificando={verificando} />

          {erroAcao && (
            <p role="alert" className="mt-4 text-sm" style={{ color: WARN_INK }}>
              {erroAcao}
            </p>
          )}

          <Cadeia
            titulo="Chain for job search"
            descricao="Needs live web search, so only three providers can appear here. Tried top to bottom."
            provedores={data.provedores.filter((p) => p.buscaWeb)}
            servindo={data.iaDaBusca}
            oQueServe="the job search"
            verificando={verificando}
            capacidade="buscaWeb"
            onMover={mover}
            onRecarregar={setData}
            acaoNoCabecalho={
              <button
                type="button"
                onClick={() => void verificarTudo()}
                disabled={verificando}
                className="min-h-8 shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                {verificando ? 'Testing…' : 'Test all keys'}
              </button>
            }
          />

          <div
            className="mt-3 rounded-lg border border-dashed p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
          >
            <p className="text-xs font-semibold">
              {data.provedores
                .filter((p) => !p.buscaWeb)
                .map((p) => p.nome.replace(/ \(.*\)$/, ''))
                .join(', ')}{' '}
              cannot do this
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              They have no web search, so they would invent jobs with URLs that
              return 404. They are used for the reading chain below.
            </p>
          </div>

          <Cadeia
            titulo="Chain for reading (resumes and job pages)"
            descricao="All six can do this. Tried top to bottom."
            provedores={data.provedores}
            servindo={data.iaDaExtracao}
            oQueServe="both reading jobs"
            verificando={verificando}
            capacidade="estruturada"
            onMover={mover}
            onRecarregar={setData}
          />

          <div
            className="mt-10 border-t pt-5"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-semibold">Firecrawl reads job pages too</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              It costs credits per page and does the same job as the reading
              chain above. It lives under{' '}
              <Link
                to="/config/vagas"
                className="font-medium underline"
                style={{ color: 'var(--accent-ink)' }}
              >
                Job sources
              </Link>
              , with the ATS and the scheduled search.
            </p>
          </div>
        </>
      )}
    </main>
  )
}

/**
 * O painel de saúde: o coração da tela.
 *
 * Uma frase que resume, e três blocos — um por uso — nomeando **quem está de
 * fato servindo**. É a diferença entre este desenho e a tela de antes: aquela
 * dizia "stored" para chaves mortas, esta diz qual uso está parado e por quê.
 */
function PainelDeSaude({
  data,
  verificando,
}: {
  data: Recursos
  verificando: boolean
}) {
  const nome = (id: ApiProvider | null) =>
    data.provedores.find((p) => p.id === id)?.nome ?? null

  const busca = nome(data.iaDaBusca)
  const extracao = nome(data.iaDaExtracao)

  // Três estados de resumo, e cada um pede uma frase diferente. Dizer só
  // "something is wrong" faria a pessoa ter de descobrir o quê rolando.
  const tudoBem = busca !== null && extracao !== null
  const nadaBem = busca === null && extracao === null

  const resumo = tudoBem
    ? 'Job search and resume reading both work.'
    : nadaBem
      ? 'No AI feature works right now.'
      : busca === null
        ? 'Resume reading works. Job search does not.'
        : 'Job search works. Resume reading does not.'

  const detalhe = tudoBem
    ? 'Every use below has a provider that answered on the last check.'
    : nadaBem
      ? 'No provider answered on the last check. Add a key below — four of the six have a free tier with no card.'
      : busca === null
        ? 'Job search needs a provider with web search: only Claude, ChatGPT or Gemini. Any of them with a working key would fix it.'
        : 'Resume reading needs any of the six with a working key.'

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: tudoBem ? 'var(--brand)' : WARN_INK }}
        />
        <div className="min-w-0">
          {/* O estado vem no TEXTO, não só na bolinha: a cor é decoração. */}
          <p className="font-semibold">{resumo}</p>
          <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {detalhe}
          </p>
        </div>
      </div>

      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
        <BlocoDeUso
          nome="Job search"
          quem={busca}
          verificando={verificando}
          nota="Needs web search: only Claude, ChatGPT or Gemini."
        />
        <BlocoDeUso
          nome="Resume reading"
          quem={extracao}
          verificando={verificando}
          nota="Any of the six can do this."
        />
        <BlocoDeUso
          nome="Reading a job page"
          quem={extracao}
          verificando={verificando}
          nota="Any of the six can do this."
        />
      </div>
    </div>
  )
}

function BlocoDeUso({
  nome,
  quem,
  nota,
  verificando,
}: {
  nome: string
  quem: string | null
  nota: string
  verificando: boolean
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <p className="text-[13px] font-semibold">{nome}</p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {verificando ? (
          <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>Checking…</span>
        ) : quem ? (
          <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{quem}</span>
        ) : (
          <span style={{ color: WARN_INK, fontWeight: 600 }}>No working provider</span>
        )}
        <br />
        {nota}
      </p>
    </div>
  )
}

/** Uma das duas cadeias, com as linhas ordenáveis. */
function Cadeia({
  titulo,
  descricao,
  provedores,
  servindo,
  oQueServe,
  verificando,
  onMover,
  onRecarregar,
  acaoNoCabecalho,
  capacidade,
}: {
  titulo: string
  descricao: string
  provedores: ProvedorIa[]
  servindo: ApiProvider | null
  oQueServe: string
  verificando: boolean
  capacidade: 'estruturada' | 'buscaWeb'
  onMover: (
    p: ProvedorIa,
    direcao: 'cima' | 'baixo',
    chaveDoFoco: string,
    cadeia: 'estruturada' | 'buscaWeb',
  ) => void
  onRecarregar: (r: Recursos) => void
  acaoNoCabecalho?: React.ReactNode
}) {
  const idTitulo = `cadeia-${titulo.replace(/\W+/g, '-').toLowerCase()}`

  return (
    <section aria-labelledby={idTitulo} className="mt-9">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">
          {titulo}
        </h2>
        {acaoNoCabecalho}
      </div>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {descricao}
      </p>

      <ul className="mt-3.5 flex list-none flex-col gap-2">
        {provedores.map((p, i) => (
          <LinhaDoProvedor
            key={p.id}
            provedor={p}
            posicao={i + 1}
            total={provedores.length}
            serve={servindo === p.id}
            oQueServe={oQueServe}
            verificando={verificando}
            capacidade={capacidade}
            idDaCadeia={idTitulo}
            onMover={onMover}
            onRecarregar={onRecarregar}
          />
        ))}
      </ul>
    </section>
  )
}

/** O selo de estado. O TEXTO carrega o estado; a bolinha é decoração. */
function Selo({ status, verificando }: { status: StatusDaChave; verificando: boolean }) {
  const { rotulo, cor } = verificando
    ? { rotulo: 'Checking…', cor: 'var(--accent-ink)' }
    : status === 'funcionando'
      ? { rotulo: 'Working', cor: 'var(--brand)' }
      : status === 'chave_recusada'
        ? { rotulo: 'Key refused', cor: WARN_INK }
        : status === 'sem_cota'
          ? { rotulo: 'Out of quota', cor: WARN_INK }
          : status === 'erro'
            ? { rotulo: 'Failed', cor: WARN_INK }
            : status === 'nao_verificado'
              ? { rotulo: 'Not tested', cor: 'var(--text-muted)' }
              : { rotulo: 'No key', cor: 'var(--text-muted)' }

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

/** Uma etiqueta curta e neutra (Paid, Free tier). */
function Etiqueta({ children, aviso }: { children: React.ReactNode; aviso?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[11.5px] font-semibold"
      style={{
        border: `1px solid ${aviso ? WARN_INK : 'var(--border)'}`,
        color: aviso ? WARN_INK : 'var(--text-muted)',
      }}
    >
      {children}
    </span>
  )
}

/**
 * Quando foi verificado, em linguagem de gente.
 *
 * **Um resultado velho não finge frescor**: passadas 24h a frase vira
 * "checked yesterday" / "checked N days ago", em vez de um horário que
 * parece recente por estar escrito com precisão.
 */
function quandoFoi(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'checked just now'
  if (min < 60) return `checked ${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `checked ${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'checked yesterday' : `checked ${d} days ago`
}

function LinhaDoProvedor({
  provedor,
  posicao,
  total,
  serve,
  oQueServe,
  verificando,
  capacidade,
  idDaCadeia,
  onMover,
  onRecarregar,
}: {
  provedor: ProvedorIa
  posicao: number
  total: number
  serve: boolean
  oQueServe: string
  verificando: boolean
  /** Qual cadeia esta linha pertence — vai junto ao mover. */
  capacidade: 'estruturada' | 'buscaWeb'
  idDaCadeia: string
  onMover: (
    p: ProvedorIa,
    direcao: 'cima' | 'baixo',
    chaveDoFoco: string,
    cadeia: 'estruturada' | 'buscaWeb',
  ) => void
  onRecarregar: (r: Recursos) => void
}) {
  const onde = ONDE[provedor.id] ?? { url: '', prefixo: '' }
  const idCampo = `${idDaCadeia}-chave-${provedor.id.toLowerCase()}`

  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // As duas chaves de foco identificam O BOTÃO, e não a posição: depois de
  // mover, é o mesmo provedor que tem de continuar focado.
  const chaveCima = `${idDaCadeia}:${provedor.id}:cima`
  const chaveBaixo = `${idDaCadeia}:${provedor.id}:baixo`

  const salvarChave = useCallback(async () => {
    const limpo = valor.trim()
    if (!limpo) {
      setErro('Paste the key before saving.')
      return
    }
    setErro(null)
    setSalvando(true)
    try {
      await api.setToken(provedor.id, limpo)
      // A chave some do campo assim que sai daqui, e a página recarrega para
      // trazer o resultado da verificação que o backend fez ao salvar.
      setValor('')
      onRecarregar(await api.recursos())
    } catch (e) {
      setErro(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }, [valor, provedor.id, onRecarregar])

  const removerChave = useCallback(async () => {
    setErro(null)
    setSalvando(true)
    try {
      await api.removeToken(provedor.id)
      onRecarregar(await api.recursos())
    } catch (e) {
      setErro(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }, [provedor.id, onRecarregar])

  const semChave = provedor.status === 'sem_chave'
  /**
   * O formulário aparece onde ele resolve algo: sem chave (cadastrar) ou com
   * chave que o provedor recusou (trocar). Com a chave funcionando, um campo
   * aberto só convida a mexer no que está certo.
   *
   * **`comFormulario` diz em QUAL cadeia ele aparece, e não se aparece.**
   * Cada provedor está nas duas listas quando faz busca na web, e repetir o
   * campo nas duas daria dois inputs para a mesma chave — com dois estados
   * locais divergentes. Então: quem faz busca na web mostra o campo na cadeia
   * de busca; quem não faz só existe na de leitura, e é lá que ele aparece.
   * Sem esta segunda metade, Groq, Cerebras e Mistral ficavam sem NENHUMA
   * forma de cadastrar chave — encontrado ao olhar a tela renderizada.
   */
  const cadeiaDoFormulario = provedor.buscaWeb ? 'buscaWeb' : 'estruturada'
  const mostraFormulario =
    capacidade === cadeiaDoFormulario &&
    (semChave || provedor.status === 'chave_recusada')

  return (
    <li
      className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border p-3 sm:p-3.5"
      style={{
        borderColor: 'var(--border)',
        background: semChave ? 'var(--surface-sunken)' : 'var(--surface-raised)',
      }}
    >
      <span
        aria-hidden
        className="w-5 pt-0.5 text-right text-[13px] font-bold tabular-nums"
        style={{ color: 'var(--text-muted)' }}
      >
        {posicao}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold">{provedor.nome}</span>
          <Selo status={provedor.status} verificando={verificando} />
          <Etiqueta>{provedor.gratuito ? 'Free tier' : 'Paid'}</Etiqueta>
          {/* Nunca atrás de clique: é o fato que contradiz a promessa da aba
              Jobs, e tem de estar onde a decisão é tomada. */}
          {provedor.treinaComOsDados && <Etiqueta aviso>Trains on your data</Etiqueta>}
        </div>

        {(provedor.hint || provedor.checkedAt || serve) && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {provedor.hint && (
              <>
                Key ends in <strong>{provedor.hint}</strong>
              </>
            )}
            {provedor.hint && provedor.checkedAt ? ' · ' : ''}
            {quandoFoi(provedor.checkedAt)}
            {serve && (
              <>
                {' · '}
                <strong style={{ color: 'var(--brand)' }}>
                  currently serving {oQueServe}
                </strong>
              </>
            )}
          </p>
        )}

        {/* O motivo é a metade útil do estado: "Key refused" não diz o que
            fazer, "401 — API key is invalid" diz. */}
        {provedor.motivo && !verificando && (
          <p
            className="mt-2 rounded-r-lg border-l-[3px] px-3 py-2 text-[12.5px] leading-relaxed"
            style={{
              borderLeftColor: provedor.status === 'nao_verificado' ? 'var(--border)' : WARN_INK,
              background: 'var(--surface-sunken)',
              color: 'var(--text-muted)',
            }}
          >
            {provedor.motivo}
          </p>
        )}

        {provedor.treinaComOsDados && semChave && (
          <p
            className="mt-2 rounded-r-lg border-l-[3px] px-3 py-2 text-[12.5px] leading-relaxed"
            style={{
              borderLeftColor: WARN_INK,
              background: 'var(--surface-sunken)',
              color: 'var(--text-muted)',
            }}
          >
            On the free tier this provider may use what it receives to improve
            its models. Resumes are sent in full — including any ID number,
            address and phone in the file.
          </p>
        )}

        {mostraFormulario && (
          <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
            <label htmlFor={idCampo} className="mb-1.5 block text-[12.5px] font-semibold">
              {semChave ? 'Key' : 'Replace key'}
            </label>
            {/* 390px: o campo ocupa a linha inteira e os botões descem. */}
            <div className="flex flex-wrap gap-1.5">
              <input
                id={idCampo}
                type="password"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value)
                  setErro(null)
                }}
                placeholder={onde.prefixo ? `${onde.prefixo}…` : 'key…'}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? `${idCampo}-erro` : undefined}
                className="min-w-0 flex-[1_1_200px] rounded-md border px-2.5 py-2 font-mono text-[13px]"
                style={{
                  borderColor: erro ? WARN_INK : 'var(--border)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text)',
                }}
              />
              <button
                type="button"
                onClick={() => void salvarChave()}
                disabled={salvando}
                className="min-h-9 rounded-md px-3.5 py-1.5 text-[13.5px] font-semibold disabled:opacity-60"
                style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
              >
                {salvando ? 'Saving…' : 'Save and test'}
              </button>
              {!semChave && (
                <button
                  type="button"
                  onClick={() => void removerChave()}
                  disabled={salvando}
                  className="min-h-9 rounded-md border px-3.5 py-1.5 text-[13.5px] font-medium disabled:opacity-60"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Remove
                </button>
              )}
            </div>
            {erro && (
              <p
                id={`${idCampo}-erro`}
                role="alert"
                className="mt-1.5 text-xs"
                style={{ color: WARN_INK }}
              >
                {erro}
              </p>
            )}
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {provedor.gratuito ? 'Free, no card. Create at ' : 'Create at '}
              <a
                href={onde.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--accent-ink)' }}
              >
                {provedor.console}
              </a>
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          data-foco={chaveCima}
          onClick={() => onMover(provedor, 'cima', chaveCima, capacidade)}
          disabled={posicao === 1 || verificando}
          aria-label={`Move ${provedor.nome} up`}
          // 32px, acima dos 24px mínimos da WCAG 2.5.8.
          className="flex h-8 w-8 items-center justify-center rounded-md border text-sm disabled:opacity-35"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <span aria-hidden>↑</span>
        </button>
        <button
          type="button"
          data-foco={chaveBaixo}
          onClick={() => onMover(provedor, 'baixo', chaveBaixo, capacidade)}
          disabled={posicao === total || verificando}
          aria-label={`Move ${provedor.nome} down`}
          className="flex h-8 w-8 items-center justify-center rounded-md border text-sm disabled:opacity-35"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <span aria-hidden>↓</span>
        </button>
      </div>
    </li>
  )
}
