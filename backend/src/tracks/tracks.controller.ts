import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { TracksService } from './tracks.service';
import type {
  LessonDetailDto,
  TrackDetailDto,
  TrackSummaryDto,
} from './track.dto';

@Controller('tracks')
@UseGuards(CurrentUserGuard)
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<TrackSummaryDto[]> {
    return this.tracks.list(user.id);
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
    @CurrentUser() user: AuthUser,
  ): Promise<TrackDetailDto> {
    return this.tracks.findBySlug(slug, user.id);
  }

  @Get(':trackSlug/lessons/:lessonSlug')
  findLesson(
    @Param('trackSlug') trackSlug: string,
    @Param('lessonSlug') lessonSlug: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LessonDetailDto> {
    return this.tracks.findLesson(trackSlug, lessonSlug, user.id);
  }
}
