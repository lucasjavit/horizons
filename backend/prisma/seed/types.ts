// Tipos usados só pelo seed. Espelham o formato de blocos que a API entrega
// em Lesson.content (ver src/tracks/track.dto.ts).

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

export type LessonKind =
  | 'ARTICLE'
  | 'VIDEO'
  | 'PAPER'
  | 'COURSE'
  | 'BOOK'
  | 'CHANNEL';

export interface LessonSeed {
  slug: string;
  title: string;
  kind?: LessonKind;
  /** Resumo de uma linha para a listagem. */
  summary: string;
  /** Leitura complementar — sempre fonte externa, nunca texto copiado dela. */
  sourceUrl?: string;
  /** Ausente = aula ainda sem conteúdo autoral escrito. */
  content?: LessonContent;
}

export interface ModuleSeed {
  slug: string;
  title: string;
  goal: string;
  lessons: LessonSeed[];
}
