import type { LessonKind } from '@prisma/client';

/**
 * DTOs de resposta da API.
 * Espelhados manualmente em frontend/src/types/api.ts — nao ha workspace
 * compartilhado, entao a duplicacao e consciente.
 */

/** Bloco de conteudo autoral de uma aula. */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; lang?: string; code: string }
  | { type: 'key'; text: string }
  | { type: 'warn'; title?: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] };

export interface LessonContent {
  summary: string;
  blocks: Block[];
  quiz?: { q: string; a: string }[];
}

/** Item da listagem em GET /tracks. */
export interface TrackSummaryDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  totalLessons: number;
  completedLessons: number;
}

export interface LessonListItemDto {
  id: string;
  slug: string;
  title: string;
  kind: LessonKind;
  summary: string | null;
  sourceUrl: string | null;
  position: number;
  /** false quando a aula ainda nao tem conteudo autoral escrito. */
  hasContent: boolean;
  completed: boolean;
}

export interface ModuleDto {
  id: string;
  slug: string;
  title: string;
  goal: string;
  position: number;
  lessons: LessonListItemDto[];
}

/** GET /tracks/:slug — arvore completa, sem o corpo das aulas. */
export interface TrackDetailDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  totalLessons: number;
  completedLessons: number;
  /** Primeira aula nao concluida, para o "continue de onde parou". */
  nextLesson: { moduleSlug: string; lessonSlug: string; title: string } | null;
  modules: ModuleDto[];
}

/** Vizinho na navegacao anterior/proxima da aula. */
export interface LessonNeighborDto {
  slug: string;
  title: string;
}

/** GET /tracks/:trackSlug/lessons/:lessonSlug */
export interface LessonDetailDto {
  id: string;
  slug: string;
  title: string;
  kind: LessonKind;
  summary: string | null;
  sourceUrl: string | null;
  content: LessonContent | null;
  completed: boolean;
  note: string | null;
  module: { slug: string; title: string; goal: string };
  track: { slug: string; title: string };
  prev: LessonNeighborDto | null;
  next: LessonNeighborDto | null;
}
