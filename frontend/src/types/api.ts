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

export type ApiProvider = 'ANTHROPIC' | 'OPENAI'

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
