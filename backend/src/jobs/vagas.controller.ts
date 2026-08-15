import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { VagasService } from './vagas.service';
import type { VagaDto } from './job.dto';

/**
 * As vagas encontradas. Rota propria, e nao sob `/jobs/profile`, porque o
 * recurso e outro: o perfil e o que a pessoa procura; isto e o que se achou.
 */
@Controller('jobs')
export class VagasController {
  constructor(private readonly vagas: VagasService) {}

  @Get()
  listar(@CurrentUser() user: AuthUser): Promise<VagaDto[]> {
    return this.vagas.listar(user.id);
  }
}
