// Espelho manual dos DTOs do backend (backend/src/tracks/track.dto.ts).
// Não há workspace compartilhado — a duplicação é consciente. Ao mudar um
// lado, mude o outro.

export type LessonKind =
  | 'ARTICLE'
  | 'VIDEO'
  | 'PAPER'
  | 'COURSE'
  | 'BOOK'
  | 'CHANNEL'

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang?: string; code: string }
  | { type: 'key'; text: string }
  | { type: 'warn'; title?: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }

export interface LessonContent {
  summary: string
  blocks: Block[]
  quiz?: { q: string; a: string }[]
}

export interface TrackSummary {
  id: string
  slug: string
  title: string
  description: string
  icon: string | null
  totalLessons: number
  completedLessons: number
}

export interface LessonListItem {
  id: string
  slug: string
  title: string
  kind: LessonKind
  summary: string | null
  sourceUrl: string | null
  position: number
  hasContent: boolean
  completed: boolean
}

export interface TrackModule {
  id: string
  slug: string
  title: string
  goal: string
  position: number
  lessons: LessonListItem[]
}

export interface TrackDetail {
  id: string
  slug: string
  title: string
  description: string
  icon: string | null
  totalLessons: number
  completedLessons: number
  nextLesson: { moduleSlug: string; lessonSlug: string; title: string } | null
  modules: TrackModule[]
}

export interface LessonNeighbor {
  slug: string
  title: string
}

export interface LessonDetail {
  id: string
  slug: string
  title: string
  kind: LessonKind
  summary: string | null
  sourceUrl: string | null
  content: LessonContent | null
  completed: boolean
  note: string | null
  module: { slug: string; title: string; goal: string }
  track: { slug: string; title: string }
  prev: LessonNeighbor | null
  next: LessonNeighbor | null
}

/** Resultado da busca no corpo das aulas (GET /tracks/:slug/search). */
export interface LessonSearchHit {
  slug: string
  title: string
  moduleTitle: string
}

export interface ProgressResult {
  lessonId: string
  completed: boolean
  completedAt: string | null
  note: string | null
}

export type ApiProvider = 'ANTHROPIC' | 'OPENAI' | 'FIRECRAWL'

/** O valor do token nunca vem da API — so o final, para reconhecer qual e. */
export interface ApiTokenInfo {
  provider: ApiProvider
  hint: string
  updatedAt: string
}

// --- Vagas (backend/src/jobs/job.dto.ts) ---

export type Senioridade =
  | 'estagio'
  | 'junior'
  | 'pleno'
  | 'senior'
  | 'staff'
  | 'principal'

export type Remoto = 'remoto' | 'hibrido' | 'presencial'

/** Espelha `REGIOES` do backend. */
export type Regiao = 'latam'

/** Espelha `IaDaBusca` do backend. */
export type IaDaBusca = 'anthropic' | 'openai'

export type Contrato = 'clt' | 'pj' | 'contractor' | 'freelance'

/**
 * Filtros da busca de vagas.
 *
 * Os nomes são `snake_case` porque é o que o prompt de busca espera — não é
 * descuido de padrão. Todos são opcionais, e o `ValidationPipe` do backend usa
 * `forbidNonWhitelisted`: campo fora desta lista **rejeita com 400**, não é
 * ignorado. `companies` e `industries` existem no backend mas a tela não os
 * oferece (decisão de produto no desenho JOB-02).
 */
export interface Filtros {
  job_titles?: string[]
  keywords?: string[]
  exclude_keywords?: string[]
  locations?: string[]
  remote?: Remoto
  /**
   * Região, não país — hoje só `'latam'`.
   *
   * Separada de `locations` porque o backend a expande nos termos que os
   * anúncios usam ("Latin America", "South America", "Brazil"), em vez de
   * mandar a sigla crua para a busca.
   */
  regiao?: Regiao
  employment_types?: Contrato[]
  seniority?: Senioridade
  /** Unidade inteira da moeda, nunca centavo — o backend exige `@IsInt()`. */
  salary_min?: number
  salary_max?: number
  currency?: string
  posted_within_days?: number
  technologies?: string[]
  visa_required?: boolean
  timezone?: string
}

/** O que fica guardado do CV. Nunca o arquivo, nunca o texto bruto. */
export interface CvProfile {
  stack?: string[]
  senioridade?: Senioridade
  anos?: number
}

export interface JobProfile {
  id: string
  filtros: Filtros
  cvProfile: CvProfile | null
  /** Assinatura dos filtros. O desenho decidiu não mostrar isto na tela. */
  grupo: string
  ativo: boolean
  updatedAt: string
}

/** Corpo do PUT /jobs/profile. */
export interface SalvarPerfil {
  filtros: Filtros
  cvProfile?: CvProfile
  ativo?: boolean
}

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  role: string
}

export interface AuthConfig {
  googleClientId: string | null
  enabled: boolean
  /** Login desligado no servidor: entra direto, sem tela. */
  authDisabled: boolean
}

/** Recursos que o admin liga e desliga em tempo de execução. */
export interface Recursos {
  leituraCvAtiva: boolean
  /** Sem chave de IA o recurso não pode ser ligado. */
  temChaveDeIa: boolean
  /** O Firecrawl está ligado e utilizável. Desligado = busca pela IA. */
  firecrawlAtivo: boolean
  /** Há ao menos um motor de busca utilizável. */
  buscaPossivel: boolean
  /** Sem token do Firecrawl a busca não pode ser ligada. */
  temChaveFirecrawl: boolean
  /** A IA escolhida pelo admin para a busca. */
  iaPreferida: IaDaBusca
  /** A que roda de fato — cai na outra se a preferida não tem chave. */
  iaEfetiva: IaDaBusca | null
  temChaveAnthropic: boolean
  temChaveOpenAi: boolean
}

/**
 * O que a leitura do currículo devolve, antes de a pessoa revisar.
 *
 * `null` em `senioridade` e `anos` é resposta legítima: o extrator devolve
 * null quando o CV não diz, em vez de chutar. Por isso o tipo aqui é mais
 * largo que `CvProfile`, onde os campos são opcionais.
 */
export interface CvLido {
  cvProfile: {
    stack: string[]
    senioridade: Senioridade | null
    anos: number | null
  }
  /** Sugestões — a tela preenche os campos, e a pessoa edita. */
  filtrosSugeridos: Partial<Filtros>
}

/**
 * Uma vaga encontrada (GET /jobs).
 *
 * **`null` é resposta legítima em todo campo opcional**, e a tela escreve "não
 * informado" em vez de inventar um número. O card JOB-04 é explícito: se a
 * tela ficar feia com campo vazio, a pressão vira preencher — e o desenho
 * passa a causar a alucinação.
 *
 * `salaryTrecho` e `elegibilidadeTrecho` são o texto do anúncio de onde a IA
 * tirou a afirmação. Ficam sob demanda no cartão: é verificável, não é
 * confiança.
 */
export interface Vaga {
  id: string
  title: string
  company: string
  url: string
  local: string | null
  /** Domínio de origem, para a pessoa calibrar a confiança sozinha. */
  fonte: string | null
  regime: string | null
  skills: string[]
  /** Área/família do cargo, como o anúncio escreveu. Ex.: "Back-end Engineer". */
  area: string | null
  /** Anos de experiência pedidos. Nulo é o caso comum. */
  anosExp: number | null
  benefits: string[]
  degree: string | null
  /** Logo da empresa. A tela cai nas iniciais quando falta. */
  logoUrl: string | null
  /** ISO-3166 alpha-2 minúsculo ("us", "br"), para a bandeirinha. */
  paisIso: string | null
  salaryMin: number | null
  salaryMax: number | null
  currency: string | null
  salaryTrecho: string | null
  elegivelBrasil: boolean | null
  elegibilidadeTrecho: string | null
  postedAt: string | null
  foundAt: string
}
