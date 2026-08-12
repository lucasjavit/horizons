import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { SetCompletedDto, SetNoteDto, type ProgressDto } from './progress.dto';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(CurrentUserGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Put(':lessonId')
  setCompleted(
    @Param('lessonId') lessonId: string,
    @Body() body: SetCompletedDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProgressDto> {
    return this.progress.setCompleted(user.id, lessonId, body.completed);
  }

  @Put(':lessonId/note')
  setNote(
    @Param('lessonId') lessonId: string,
    @Body() body: SetNoteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProgressDto> {
    return this.progress.setNote(user.id, lessonId, body.note);
  }
}
