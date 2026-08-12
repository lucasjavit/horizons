import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  LessonContent,
  LessonDetailDto,
  LessonListItemDto,
  TrackDetailDto,
  TrackSummaryDto,
} from './track.dto';

@Injectable()
export class TracksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<TrackSummaryDto[]> {
    const tracks = await this.prisma.track.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        icon: true,
        modules: { select: { lessons: { select: { id: true } } } },
      },
    });

    const lessonIds = tracks.flatMap((track) =>
      track.modules.flatMap((mod) => mod.lessons.map((lesson) => lesson.id)),
    );
    const completed = await this.completedLessonIds(userId, lessonIds);

    return tracks.map((track) => {
      const ids = track.modules.flatMap((mod) => mod.lessons.map((l) => l.id));
      return {
        id: track.id,
        slug: track.slug,
        title: track.title,
        description: track.description,
        icon: track.icon,
        totalLessons: ids.length,
        completedLessons: ids.filter((id) => completed.has(id)).length,
      };
    });
  }

  async findBySlug(slug: string, userId: string): Promise<TrackDetailDto> {
    const track = await this.prisma.track.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        icon: true,
        modules: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            slug: true,
            title: true,
            goal: true,
            position: true,
            lessons: {
              orderBy: { position: 'asc' },
              // `content` fica de fora de proposito: a arvore inteira com o
              // corpo das aulas deixaria a resposta pesada demais. Quem tem
              // conteudo escrito vem da query `lessonsWithContent` abaixo.
              select: {
                id: true,
                slug: true,
                title: true,
                kind: true,
                summary: true,
                sourceUrl: true,
                position: true,
              },
            },
          },
        },
      },
    });

    if (!track) {
      throw new NotFoundException(`Trilha "${slug}" nao encontrada`);
    }

    const lessonIds = track.modules.flatMap((mod) =>
      mod.lessons.map((lesson) => lesson.id),
    );
    const [completed, withContent] = await Promise.all([
      this.completedLessonIds(userId, lessonIds),
      this.lessonsWithContent(track.id),
    ]);

    let nextLesson: TrackDetailDto['nextLesson'] = null;
    const modules = track.modules.map((mod) => {
      const lessons: LessonListItemDto[] = mod.lessons.map((lesson) => {
        const isCompleted = completed.has(lesson.id);
        if (!nextLesson && !isCompleted) {
          nextLesson = {
            moduleSlug: mod.slug,
            lessonSlug: lesson.slug,
            title: lesson.title,
          };
        }
        return {
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          kind: lesson.kind,
          summary: lesson.summary,
          sourceUrl: lesson.sourceUrl,
          position: lesson.position,
          hasContent: withContent.has(lesson.id),
          completed: isCompleted,
        };
      });
      return {
        id: mod.id,
        slug: mod.slug,
        title: mod.title,
        goal: mod.goal,
        position: mod.position,
        lessons,
      };
    });

    return {
      id: track.id,
      slug: track.slug,
      title: track.title,
      description: track.description,
      icon: track.icon,
      totalLessons: lessonIds.length,
      completedLessons: lessonIds.filter((id) => completed.has(id)).length,
      nextLesson,
      modules,
    };
  }

  async findLesson(
    trackSlug: string,
    lessonSlug: string,
    userId: string,
  ): Promise<LessonDetailDto> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { slug: lessonSlug, module: { track: { slug: trackSlug } } },
      select: {
        id: true,
        slug: true,
        title: true,
        kind: true,
        summary: true,
        sourceUrl: true,
        content: true,
        position: true,
        module: {
          select: {
            id: true,
            slug: true,
            title: true,
            goal: true,
            position: true,
            trackId: true,
            track: { select: { slug: true, title: true } },
          },
        },
        progress: {
          where: { userId },
          select: { completed: true, note: true },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(
        `Aula "${lessonSlug}" nao encontrada na trilha "${trackSlug}"`,
      );
    }

    const { prev, next } = await this.neighbors(
      lesson.module.trackId,
      lesson.module.position,
      lesson.position,
    );

    const progress = lesson.progress[0];

    return {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      kind: lesson.kind,
      summary: lesson.summary,
      sourceUrl: lesson.sourceUrl,
      content: (lesson.content as LessonContent | null) ?? null,
      completed: progress?.completed ?? false,
      note: progress?.note ?? null,
      module: {
        slug: lesson.module.slug,
        title: lesson.module.title,
        goal: lesson.module.goal,
      },
      track: lesson.module.track,
      prev,
      next,
    };
  }

  /**
   * Busca no corpo das aulas. O filtro por titulo e resumo ja acontece no
   * cliente com os dados que ele tem; este endpoint cobre so o que o cliente
   * nao tem — o texto das aulas.
   */
  async searchLessons(
    trackSlug: string,
    termo: string,
  ): Promise<{ slug: string; title: string; moduleTitle: string }[]> {
    const busca = termo.trim();
    if (busca.length < 2) return [];

    // unaccent nao esta instalado; ILIKE sobre o JSON serializado resolve num
    // catalogo desta ordem de grandeza (75 aulas) sem indice dedicado.
    return this.prisma.$queryRaw<
      { slug: string; title: string; moduleTitle: string }[]
    >`
      SELECT l.slug, l.title, m.title AS "moduleTitle"
      FROM lessons l
      JOIN modules m ON m.id = l."moduleId"
      JOIN tracks t ON t.id = m."trackId"
      WHERE t.slug = ${trackSlug}
        AND l.content::text ILIKE ${'%' + busca + '%'}
      ORDER BY m.position, l.position
      LIMIT 30
    `;
  }

  /** Ids concluidos entre os informados — uma query so, em vez de N. */
  private async completedLessonIds(
    userId: string,
    lessonIds: string[],
  ): Promise<Set<string>> {
    if (lessonIds.length === 0) return new Set();
    const rows = await this.prisma.progress.findMany({
      where: { userId, completed: true, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    });
    return new Set(rows.map((row) => row.lessonId));
  }

  /**
   * Quais aulas da trilha ja tem conteudo autoral.
   * Query crua para nao trazer o JSON inteiro so para checar se e nulo.
   */
  private async lessonsWithContent(trackId: string): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT l.id
      FROM lessons l
      JOIN modules m ON m.id = l."moduleId"
      WHERE m."trackId" = ${trackId} AND l.content IS NOT NULL
    `;
    return new Set(rows.map((row) => row.id));
  }

  /**
   * Vizinhos na ordem de leitura da trilha inteira: a navegacao atravessa a
   * fronteira dos modulos, entao ordenamos por (posicao do modulo, posicao da
   * aula) e olhamos o indice atual.
   */
  private async neighbors(
    trackId: string,
    modulePosition: number,
    lessonPosition: number,
  ): Promise<{
    prev: LessonDetailDto['prev'];
    next: LessonDetailDto['next'];
  }> {
    const all = await this.prisma.lesson.findMany({
      where: { module: { trackId } },
      orderBy: [{ module: { position: 'asc' } }, { position: 'asc' }],
      select: {
        slug: true,
        title: true,
        position: true,
        module: { select: { position: true } },
      },
    });

    const index = all.findIndex(
      (item) =>
        item.module.position === modulePosition &&
        item.position === lessonPosition,
    );

    const toNeighbor = (item: (typeof all)[number] | undefined) =>
      item ? { slug: item.slug, title: item.title } : null;

    return {
      prev: index > 0 ? toNeighbor(all[index - 1]) : null,
      next: index >= 0 ? toNeighbor(all[index + 1]) : null,
    };
  }
}
