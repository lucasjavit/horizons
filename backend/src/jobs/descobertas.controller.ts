import { Controller, Get, Post } from '@nestjs/common';
import { AdminOnly } from '../auth/current-user';
import { DescobertasService, type HostDescobertoDto } from './descobertas.service';
import { VerificacaoDeAtsService } from './verificacao-de-ats.service';

/**
 * A fila de descobertas do catalogo de ATS (JOB-37).
 *
 * Tudo aqui e `@AdminOnly()`: e insumo de decisao de catalogo, nao de busca.
 * Quem usa a tela de vagas nao tem o que fazer com esta lista.
 */
@Controller('jobs/descobertas')
export class DescobertasController {
  constructor(
    private readonly descobertas: DescobertasService,
    private readonly verificacao: VerificacaoDeAtsService,
  ) {}

  @Get()
  @AdminOnly()
  porHost(): Promise<HostDescobertoDto[]> {
    return this.descobertas.porHost();
  }

  /**
   * Roda a verificacao agora, sem esperar as 3h.
   *
   * **`POST` e nao `GET`**, pelo mesmo motivo de `verificar-chaves`: isto sai
   * para a rede, a uma consulta a cada 5s. Um GET convidaria o navegador a
   * repetir sozinho.
   */
  @Post('verificar')
  @AdminOnly()
  verificar(): Promise<{ verificadas: number }> {
    return this.verificacao.verificarAgora();
  }
}
