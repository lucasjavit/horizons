import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SetCompletedDto {
  @IsBoolean()
  completed!: boolean;
}

export class SetNoteDto {
  @IsString()
  @MaxLength(10_000)
  note!: string;
}

/** Resposta de qualquer mutacao de progresso. */
export interface ProgressDto {
  lessonId: string;
  completed: boolean;
  completedAt: string | null;
  note: string | null;
}
