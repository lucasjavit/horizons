import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProgressDto } from './progress.dto';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async setCompleted(
    userId: string,
    lessonId: string,
    completed: boolean,
  ): Promise<ProgressDto> {
    await this.assertLessonExists(lessonId);
    const completedAt = completed ? new Date() : null;

    const row = await this.prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, completed, completedAt },
      update: { completed, completedAt },
    });

    return this.toDto(row);
  }

  async setNote(
    userId: string,
    lessonId: string,
    note: string,
  ): Promise<ProgressDto> {
    await this.assertLessonExists(lessonId);

    const row = await this.prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, note },
      update: { note },
    });

    return this.toDto(row);
  }

  // Sem isso o upsert falharia com erro de FK cru (500) em vez de um 404 claro.
  private async assertLessonExists(lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw new NotFoundException(`Aula "${lessonId}" nao encontrada`);
    }
  }

  private toDto(row: {
    lessonId: string;
    completed: boolean;
    completedAt: Date | null;
    note: string | null;
  }): ProgressDto {
    return {
      lessonId: row.lessonId,
      completed: row.completed,
      completedAt: row.completedAt?.toISOString() ?? null,
      note: row.note,
    };
  }
}
