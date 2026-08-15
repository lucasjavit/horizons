import { useCallback, useMemo, useState } from 'react'
import { BotaoGoogle } from '../components/BotaoGoogle'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { Recolhivel } from '../components/Recolhivel'
import { ErrorState, LoadingState } from '../components/States'
import { CaixaUploadCV } from '../components/vagas/CaixaUploadCV'
import { CampoFichas } from '../components/vagas/CampoFichas'
import { SelectField, TextField } from '../components/vagas/Field'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useSessao } from '../lib/sessao'
import type {
  AuthUser,
  Contrato,
  CvLido,
  Filtros,
  JobProfile,
} from '../types/api'

/**
 * Cadastro do perfil de busca de vagas (JOB-02).
 *
 * Uma tela só, sempre a mesma: caixa de upload no topo como oferta, filtros
 * essenciais visíveis, avançados recolhidos. **Não existe tela de escolha**
 * entre "subir CV" ou "preencher na mão" — o currículo é um filtro a mais, o
 * mais poderoso deles, e o teste do desenho é que ignorar a caixa de upload
 * não custe nada.
 *
 * O estado vazio é o próprio formulário, e não o `EmptyState` de `States.tsx`:
 * aquele é um parágrafo centralizado de uma linha, e aqui o vazio precisa
 * ensinar a feature inteira.
 */

const SENIORIDADES = [
  { value: '', label: 'Qualquer uma' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'junior', label: 'Júnior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Sênior' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
] as const

const MOEDAS = [
  { value: '', label: 'Escolha a moeda' },
  { value: 'USD', label: 'USD — dólar' },
  { value: 'EUR', label: 'EUR — euro' },
  { value: 'GBP', label: 'GBP — libra' },
  { value: 'BRL', label: 'BRL — real' },
] as const

const DIAS = [
  { value: '', label: 'Qualquer data' },
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
] as const

// Lista curta de propósito: fuso é refinamento, e um select com 400 zonas IANA
// é pior que cinco opções que cobrem quem procura vaga fora do Brasil.
const FUSOS = [
  { value: '', label: 'Não informar' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (UTC−3)' },
  { value: 'America/New_York', label: 'America/New_York (UTC−5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC−8)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (UTC+0)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1)' },
] as const

const CONTRATOS: ReadonlyArray<{ value: Contrato; label: string }> = [
  { value: 'clt', label: 'CLT/Full-time' },
  { value: 'pj', label: 'PJ/Contract' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'freelance', label: 'Freelance' },
]

const REMOTOS = [
  { value: '', label: 'Tanto faz' },
  { value: 'remoto', label: 'Só vagas remotas' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'presencial', label: 'Presencial' },
] as const

/** O formulário inteiro em strings e listas — o que os controles sabem editar. */
interface Formulario {
  job_titles: string[]
  technologies: string[]
  locations: string[]
  keywords: string[]
  exclude_keywords: string[]
  seniority: string
  remote: string
  // Salário é string, não número: um input controlado por número não
  // representa "" nem "9". A conversão para inteiro acontece no envio.
  salary_min: string
  salary_max: string
  currency: string
  posted_within_days: string
  timezone: string
  employment_types: Contrato[]
  visa_required: boolean
}

const VAZIO: Formulario = {
  job_titles: [],
  technologies: [],
  locations: [],
  keywords: [],
  exclude_keywords: [],
  seniority: '',
  remote: '',
  salary_min: '',
  salary_max: '',
  currency: '',
  posted_within_days: '',
  timezone: '',
  employment_types: [],
  visa_required: false,
}

/** Traz o perfil salvo de volta para o formato do formulário. */
function paraFormulario(filtros: Filtros): Formulario {
  return {
    job_titles: filtros.job_titles ?? [],
    technologies: filtros.technologies ?? [],
    locations: filtros.locations ?? [],
    keywords: filtros.keywords ?? [],
    exclude_keywords: filtros.exclude_keywords ?? [],
    seniority: filtros.seniority ?? '',
    remote: filtros.remote ?? '',
    salary_min: filtros.salary_min != null ? String(filtros.salary_min) : '',
    salary_max: filtros.salary_max != null ? String(filtros.salary_max) : '',
    currency: filtros.currency ?? '',
    posted_within_days:
      filtros.posted_within_days != null ? String(filtros.posted_within_days) : '',
    timezone: filtros.timezone ?? '',
    employment_types: filtros.employment_types ?? [],
    visa_required: filtros.visa_required ?? false,
  }
}

/**
 * Monta o corpo do PUT, **omitindo tudo que está vazio**.
 *
 * Omitir e não mandar `''`/`[]`: o `ValidationPipe` do backend usa
 * `forbidNonWhitelisted`, e `remote: ''` não está em `REMOTOS` — viraria 400.
 * Campo vazio simplesmente não é filtro.
 */
function paraFiltros(f: Formulario): Filtros {
  const filtros: Filtros = {}

  if (f.job_titles.length) filtros.job_titles = f.job_titles
  if (f.technologies.length) filtros.technologies = f.technologies
  if (f.locations.length) filtros.locations = f.locations
  if (f.keywords.length) filtros.keywords = f.keywords
  if (f.exclude_keywords.length) filtros.exclude_keywords = f.exclude_keywords
  if (f.seniority) filtros.seniority = f.seniority as Filtros['seniority']
  if (f.remote) filtros.remote = f.remote as Filtros['remote']
  if (f.currency) filtros.currency = f.currency
  if (f.timezone) filtros.timezone = f.timezone
  if (f.employment_types.length) filtros.employment_types = f.employment_types
  // Só vai quando é `true`: `false` é o padrão, e mandar o padrão só engorda o
  // JSON que entra no prompt.
  if (f.visa_required) filtros.visa_required = true

  const min = Number(f.salary_min)
  if (f.salary_min && Number.isInteger(min)) filtros.salary_min = min
  const max = Number(f.salary_max)
  if (f.salary_max && Number.isInteger(max)) filtros.salary_max = max
  const dias = Number(f.posted_within_days)
  if (f.posted_within_days && Number.isInteger(dias)) filtros.posted_within_days = dias

  return filtros
}

/** Um filtro preenchido é o que salva — nenhum campo é obrigatório sozinho. */
function temAlgumFiltro(f: Formulario): boolean {
  return Object.keys(paraFiltros(f)).length > 0
}

type ErrosCampo = Partial<Record<'salary_min' | 'salary_max' | 'currency' | 'geral', string>>

/**
 * As regras da §3 do desenho.
 *
 * Roda só quando a pessoa clica em salvar: validar enquanto digita acusaria
 * "use só números" no primeiro caractere de "90000".
 */
function validar(f: Formulario): ErrosCampo {
  const erros: ErrosCampo = {}

  const numerico = (v: string) => /^\d+$/.test(v)

  if (f.salary_min && !numerico(f.salary_min)) {
    erros.salary_min = 'Use só números, sem pontos nem vírgulas. Ex.: 90000'
  }
  if (f.salary_max && !numerico(f.salary_max)) {
    erros.salary_max = 'Use só números, sem pontos nem vírgulas. Ex.: 90000'
  }

  if (!erros.salary_min && !erros.salary_max && f.salary_min && f.salary_max) {
    if (Number(f.salary_min) > Number(f.salary_max)) {
      erros.salary_min = 'O mínimo está acima do máximo.'
      erros.salary_max = 'O mínimo está acima do máximo.'
    }
  }

  // Um número sem moeda não é filtro, é ruído.
  if ((f.salary_min || f.salary_max) && !f.currency) {
    erros.currency = 'Escolha a moeda do salário.'
  }

  if (!temAlgumFiltro(f)) {
    erros.geral =
      'Preencha pelo menos um filtro, ou suba o seu currículo — senão a busca não sabe o que procurar.'
  }

  return erros
}

export function VagasPage() {
  useDocumentTitle('Vagas')
  const sessao = useSessao()

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Seu perfil de busca
        </h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          A cada 50 minutos procuramos vagas que batem com este perfil. Você não
          precisa ficar olhando — elas aparecem aqui sozinhas.
        </p>
      </header>

      {/* A rota exige sessão porque o perfil é de alguém: o backend não tem
          @Public() nem @SessaoOpcional() aqui. Mostrar o formulário para quem
          não entrou daria 401 só na hora de salvar, jogando fora o que a
          pessoa preencheu. */}
      {sessao ? <Formulario /> : <ConviteParaEntrar />}
    </main>
  )
}

/** Sem sessão não há formulário — há um convite que explica o porquê. */
function ConviteParaEntrar() {
  // O App guarda a sessão; entrar aqui recarrega para o contexto reabrir com o
  // usuário. É uma tela só, e recarregar evita duplicar o estado de sessão.
  const aoEntrar = useCallback((_u: AuthUser) => {
    window.location.reload()
  }, [])

  return (
    <section
      className="rounded-xl border p-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      aria-labelledby="entrar-titulo"
    >
      <h2 id="entrar-titulo" className="text-lg font-semibold">
        Entre para montar o seu perfil
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        O perfil de busca é seu: fica guardado na sua conta e é o que a busca lê
        a cada rodada. Entre com o Google para cadastrar o seu.
      </p>
      <div className="mt-4">
        <BotaoGoogle onEntrou={aoEntrar} tamanho="normal" />
      </div>
    </section>
  )
}

function Formulario() {
  const { data, loading, error, reload, setData } = useAsync(
    (signal) => api.getJobProfile(signal),
    [],
  )
  // A leitura de curriculo e um recurso que o admin liga em Configuracoes, e
  // so liga se houver chave de IA. Carrega em separado do perfil: se esta
  // chamada falhar, o formulario continua funcionando sem a caixa de upload.
  const recursos = useAsync((signal) => api.recursos(signal), [])

  if (loading) return <LoadingState label="Carregando o seu perfil…" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  // `key` remonta o formulário quando o perfil carrega: sem ele o estado
  // inicial ficaria preso no primeiro render, ainda vazio.
  return (
    <FormularioPerfil
      leituraCvAtiva={recursos.data?.leituraCvAtiva}
      key={data?.updatedAt ?? 'novo'}
      perfil={data}
      onSalvou={(p) => setData(p)}
    />
  )
}

function FormularioPerfil({
  perfil,
  onSalvou,
  leituraCvAtiva,
}: {
  perfil: JobProfile | null
  onSalvou: (p: JobProfile) => void
  /** `undefined` enquanto carrega: a caixa de upload nao aparece ainda. */
  leituraCvAtiva: boolean | undefined
}) {
  const inicial = useMemo(
    () => (perfil ? paraFormulario(perfil.filtros) : VAZIO),
    [perfil],
  )

  const [form, setForm] = useState<Formulario>(inicial)
  const [avancados, setAvancados] = useState(false)
  const [erros, setErros] = useState<ErrosCampo>({})
  // Erro da mutação, separado do erro do useAsync: um é "não carregou", o
  // outro é "não salvou", e tratá-los juntos apagaria o formulário na falha.
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo'>(
    perfil ? 'salvo' : 'ocioso',
  )
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  // O perfil lido do CV segue junto no PUT: e ele que o job de 50 minutos usa
  // para qualificar a pessoa, alem dos filtros.
  const [cvProfile, setCvProfile] = useState<CvLido['cvProfile'] | null>(
    (perfil?.cvProfile as CvLido['cvProfile'] | null) ?? null,
  )

  // "Salvar alterações" fica desabilitado até algo mudar, como o desenho pede.
  const mudou = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(inicial),
    [form, inicial],
  )

  const editar = useCallback(<K extends keyof Formulario>(campo: K, valor: Formulario[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setEstado('ocioso')
  }, [])

  const salvar = useCallback(async () => {
    const encontrados = validar(form)
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) {
      // Abre os avançados se o erro está escondido lá dentro: mensagem de erro
      // dentro de um bloco fechado é mensagem que ninguém lê.
      if (encontrados.salary_min || encontrados.salary_max || encontrados.currency) {
        setAvancados(true)
      }
      return
    }

    setErroSalvar(null)
    setEstado('salvando')
    try {
      const salvo = await api.saveJobProfile({
        filtros: paraFiltros(form),
        // `null` do extrator vira campo ausente no PUT: o DTO do backend usa
        // opcional, e mandar null seria rejeitado pelo class-validator.
        ...(cvProfile
          ? {
              cvProfile: {
                ...(cvProfile.stack.length ? { stack: cvProfile.stack } : {}),
                ...(cvProfile.senioridade
                  ? { senioridade: cvProfile.senioridade }
                  : {}),
                ...(cvProfile.anos != null ? { anos: cvProfile.anos } : {}),
              },
            }
          : {}),
      })
      onSalvou(salvo)
      setEstado('salvo')
    } catch (e) {
      setEstado('ocioso')
      setErroSalvar(errorMessage(e))
    }
  }, [form, cvProfile, onSalvou])

  return (
    // min-h e o mt-auto da barra andam juntos: `sticky bottom-0` gruda na
    // posicao natural do elemento, e numa pagina mais curta que a janela essa
    // posicao fica no MEIO do conteudo — a barra cobria o campo "Onde". Empurrar
    // a barra para o fim de um container de altura minima da janela resolve nos
    // dois casos, sem `fixed` (que tiraria a barra do fluxo e exigiria reservar
    // espaco embaixo na mao).
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-8">
      <CaixaUploadCV
        ativa={leituraCvAtiva}
        onLeu={(lido) => {
          // Só os campos que o CV realmente sugeriu — o que a pessoa já tinha
          // digitado fica onde estava. `paraFormulario` traduz do formato da
          // API para o do formulário (número vira string, ausente vira '').
          const doCv = paraFormulario(lido.filtrosSugeridos as Filtros)
          setForm((f) => ({
            ...f,
            ...(lido.filtrosSugeridos.job_titles?.length
              ? { job_titles: doCv.job_titles }
              : {}),
            ...(lido.filtrosSugeridos.technologies?.length
              ? { technologies: doCv.technologies }
              : {}),
            ...(lido.filtrosSugeridos.seniority
              ? { seniority: doCv.seniority }
              : {}),
          }))
          setCvProfile(lido.cvProfile)
          setEstado('ocioso')
        }}
      />

      <section aria-labelledby="procura-titulo" className="flex flex-col gap-5">
        <h2
          id="procura-titulo"
          className="border-b pb-2 text-sm font-semibold uppercase tracking-wide"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          O que você procura
        </h2>

        <CampoFichas
          id="job-titles"
          label="Cargos"
          valores={form.job_titles}
          onChange={(v) => editar('job_titles', v)}
          maxItens={10}
          maxTamanho={80}
          placeholder="Backend Engineer"
          hint="Enter para adicionar. Ex.: Backend Engineer, Software Engineer"
        />

        <CampoFichas
          id="technologies"
          label="Tecnologias"
          valores={form.technologies}
          onChange={(v) => editar('technologies', v)}
          maxItens={20}
          maxTamanho={40}
          placeholder="Node.js"
          hint="Enter para adicionar. Ex.: Node.js, React, AWS"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            id="seniority"
            label="Senioridade"
            value={form.seniority}
            onChange={(v) => editar('seniority', v)}
            options={SENIORIDADES}
          />

          {/* Rádio e não select: são quatro opções curtas e mutuamente
              exclusivas, e vê-las todas de uma vez é o ponto. */}
          <fieldset>
            <legend className="mb-1 block text-sm font-medium">Trabalho remoto</legend>
            <div className="flex flex-col gap-1.5">
              {REMOTOS.map((o) => (
                <label
                  key={o.value}
                  htmlFor={`remote-${o.value || 'qualquer'}`}
                  className="flex min-h-6 items-center gap-2 text-sm"
                >
                  <input
                    id={`remote-${o.value || 'qualquer'}`}
                    type="radio"
                    name="remote"
                    value={o.value}
                    checked={form.remote === o.value}
                    onChange={() => editar('remote', o.value)}
                    className="h-4 w-4"
                    style={{ accentColor: 'var(--brand)' }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <CampoFichas
          id="locations"
          label="Onde"
          valores={form.locations}
          onChange={(v) => editar('locations', v)}
          maxItens={10}
          maxTamanho={60}
          placeholder="Portugal"
          hint="País, cidade ou região. Vazio = qualquer lugar."
        />
      </section>

      <section>
        <button
          type="button"
          onClick={() => setAvancados((a) => !a)}
          aria-expanded={avancados}
          aria-controls="mais-filtros"
          className="flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <span aria-hidden>{avancados ? '▾' : '▸'}</span>
          Mais filtros (salário, fuso, visto, palavras)
        </button>

        <Recolhivel aberto={avancados} id="mais-filtros">
          <div className="flex flex-col gap-5 pt-5">
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                id="salary-min"
                label="Salário mínimo anual"
                value={form.salary_min}
                onChange={(v) => editar('salary_min', v)}
                error={erros.salary_min}
                inputMode="numeric"
                placeholder="90000"
              />
              <TextField
                id="salary-max"
                label="Salário máximo anual"
                value={form.salary_max}
                onChange={(v) => editar('salary_max', v)}
                error={erros.salary_max}
                inputMode="numeric"
              />
              <SelectField
                id="currency"
                label="Moeda"
                value={form.currency}
                onChange={(v) => editar('currency', v)}
                options={MOEDAS}
                error={erros.currency}
              />
            </div>
            <p className="-mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Vaga sem salário publicado continua aparecendo.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-1 block text-sm font-medium">Tipo de contrato</legend>
                <div className="flex flex-col gap-1.5">
                  {CONTRATOS.map((c) => (
                    <label
                      key={c.value}
                      htmlFor={`contrato-${c.value}`}
                      className="flex min-h-6 items-center gap-2 text-sm"
                    >
                      <input
                        id={`contrato-${c.value}`}
                        type="checkbox"
                        checked={form.employment_types.includes(c.value)}
                        onChange={(e) =>
                          editar(
                            'employment_types',
                            e.target.checked
                              ? [...form.employment_types, c.value]
                              : form.employment_types.filter((v) => v !== c.value),
                          )
                        }
                        className="h-4 w-4"
                        style={{ accentColor: 'var(--brand)' }}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-5">
                <SelectField
                  id="posted-within-days"
                  label="Publicadas nos últimos"
                  value={form.posted_within_days}
                  onChange={(v) => editar('posted_within_days', v)}
                  options={DIAS}
                />
                <SelectField
                  id="timezone"
                  label="Seu fuso"
                  value={form.timezone}
                  onChange={(v) => editar('timezone', v)}
                  options={FUSOS}
                />
              </div>
            </div>

            <label
              htmlFor="visa-required"
              className="flex min-h-6 items-center gap-2 text-sm font-medium"
            >
              <input
                id="visa-required"
                type="checkbox"
                checked={form.visa_required}
                onChange={(e) => editar('visa_required', e.target.checked)}
                className="h-4 w-4"
                style={{ accentColor: 'var(--brand)' }}
              />
              Mostrar só vagas que patrocinam visto
            </label>

            <CampoFichas
              id="keywords"
              label="Palavras que a vaga deve ter"
              valores={form.keywords}
              onChange={(v) => editar('keywords', v)}
              maxItens={20}
              maxTamanho={40}
              hint="A vaga precisa mencionar estas palavras."
            />

            <CampoFichas
              id="exclude-keywords"
              label="Palavras que eliminam a vaga"
              valores={form.exclude_keywords}
              onChange={(v) => editar('exclude_keywords', v)}
              maxItens={20}
              maxTamanho={40}
              placeholder="júnior"
              hint="Se a vaga tiver qualquer uma delas, ela não aparece."
            />
          </div>
        </Recolhivel>
      </section>

      {/* Barra do rodape.

          `sticky bottom-0` **so no celular** (ate sm), onde com "Mais filtros"
          aberto a pagina passa de 2.000px e o botao ficaria longe do polegar.
          No desktop ela solta e fica no fim do formulario.

          O motivo e medido: `sticky` gruda na posicao natural do elemento, e
          num formulario mais alto que a janela essa posicao cai no MEIO do
          conteudo — a barra flutuava sobre "Senioridade" e sobre o campo de
          salario minimo, em qualquer rolagem. `mt-auto` num container de
          altura minima resolve so quando o conteudo cabe na janela; aqui nao
          cabe. No celular o problema nao aparece porque a barra ocupa a
          largura toda e o formulario e de uma coluna so. */}
      <div
        className="sticky bottom-0 -mx-4 mt-auto border-t px-4 py-4 sm:static sm:-mx-6 sm:px-6"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void salvar()}
            // Nunca desabilitado por formulário vazio: botão cinza e mudo não
            // ensina o que falta. Ele clica e explica (erros.geral).
            disabled={estado === 'salvando' || (estado === 'salvo' && !mudou)}
            className="rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {estado === 'salvando'
              ? 'Salvando…'
              : perfil
                ? 'Salvar alterações'
                : 'Salvar'}
          </button>

          {!perfil && !erros.geral && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Você pode mudar tudo isso depois.
            </span>
          )}

          {/* A confirmação e o que vem depois de salvar. aria-live para quem
              não vê a faixa aparecer. */}
          <p role="status" aria-live="polite" className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {estado === 'salvo' && !mudou
              ? 'Perfil salvo. A próxima rodada acontece em até 50 minutos.'
              : ''}
          </p>
        </div>

        {erros.geral && (
          <p role="alert" className="mt-2 text-sm" style={{ color: WARN_INK }}>
            {erros.geral}
          </p>
        )}

        {erroSalvar && (
          <p role="alert" className="mt-2 text-sm" style={{ color: WARN_INK }}>
            {erroSalvar}
          </p>
        )}
      </div>
    </div>
  )
}
