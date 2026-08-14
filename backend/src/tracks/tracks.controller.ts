import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  CurrentUser,
  SessaoOpcional,
  type AuthUser,
} from '../auth/current-user';
import { TracksService } from './tracks.service';
import type {
  LessonDetailDto,
  TrackDetailDto,
  TrackSummaryDto,
} from './track.dto';

// Ler trilha e aula nao exige sessao: o conteudo e a vitrine, e obrigar
// login antes de mostrar qualquer coisa e o que faz alguem fechar a aba.
// Quem tem sessao recebe a mesma resposta com o progresso preenchido.
@SessaoOpcional()
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser | null): Promise<TrackSummaryDto[]> {
    return this.tracks.list(user?.id ?? null);
  }

  // Vem antes de ':slug' de proposito: registrada depois, a rota generica
  // capturaria "search" como se fosse um slug de trilha.
  @Get(':slug/search')
  search(
    @Param('slug') slug: string,
    @Query('q') q = '',
  ): Promise<{ slug: string; title: string; moduleTitle: string }[]> {
    return this.tracks.searchLessons(slug, q);
  }

  @Get(':slug')
  findOne(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | null,
  ): Promise<TrackDetailDto> {
    return this.tracks.findBySlug(slug, user?.id ?? null);
  }

  @Get(':trackSlug/lessons/:lessonSlug')
  findLesson(
    @Param('trackSlug') trackSlug: string,
    @Param('lessonSlug') lessonSlug: string,
    @CurrentUser() user: AuthUser | null,
  ): Promise<LessonDetailDto> {
    return this.tracks.findLesson(trackSlug, lessonSlug, user?.id ?? null);
  }
}
