import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CvExtratorService } from './cv-extrator.service';
import { CvParserService, TAMANHO_MAXIMO } from './cv-parser.service';
import { RecursosService } from '../settings/recursos.service';
import { VagasService } from './vagas.service';
import { CurrentUser, type AuthUser } from '../auth/current-user';
import { JobsService } from './jobs.service';
import { SalvarPerfilDto } from './job.dto';
import type { CvLidoDto, JobProfileDto, VagaDto } from './job.dto';

// Sem @Public() nem @SessaoOpcional(): o perfil de busca e de alguem, e nao
// faz sentido anonimo. O guard global ja fecha por padrao.
@Controller('jobs/profile')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly parser: CvParserService,
    private readonly extrator: CvExtratorService,
    private readonly recursos: RecursosService,
  ) {}

  @Get()
  obter(@CurrentUser() user: AuthUser): Promise<JobProfileDto | null> {
    return this.jobs.obter(user.id);
  }

  // PUT e nao POST: um perfil por pessoa, e salvar de novo substitui.
  @Put()
  salvar(
    @Body() body: SalvarPerfilDto,
    @CurrentUser() user: AuthUser,
  ): Promise<JobProfileDto> {
    return this.jobs.salvar(user.id, body);
  }

  @Delete()
  @HttpCode(204)
  remover(@CurrentUser() user: AuthUser): Promise<void> {
    return this.jobs.remover(user.id);
  }

  /**
   * Le um curriculo e devolve o perfil, para a pessoa revisar.
   *
   * Nao salva nada: o arquivo vive em memoria e morre com a requisicao. O que
   * fica guardado e o que a pessoa confirmar depois, no PUT acima.
   *
   * `memoryStorage` e explicito de proposito — o default do multer grava em
   * disco, e o card exige que nenhum arquivo sobre no servidor.
   */
  @Post('cv')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      limits: { fileSize: TAMANHO_MAXIMO },
    }),
  )
  async lerCurriculo(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
  ): Promise<CvLidoDto> {
    // O toggle e checado AQUI, e nao so na tela. Um recurso desligado que o
    // servidor ainda aceita nao esta desligado — esta escondido, e qualquer
    // um com curl continua gastando a chave de IA do admin.
    const { leituraCvAtiva } = await this.recursos.obter();
    if (!leituraCvAtiva) {
      throw new BadRequestException(
        'A leitura de curriculo esta desligada. Preencha os filtros a mao.',
      );
    }

    if (!arquivo) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    const texto = await this.parser.extrairTexto(arquivo);
    return this.extrator.extrair(texto);
  }
}
