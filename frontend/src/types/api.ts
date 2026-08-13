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
