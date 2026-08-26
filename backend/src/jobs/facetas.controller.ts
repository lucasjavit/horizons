import { Body, Controller, Post } from '@nestjs/common';
import { SessaoOpcional } from '../auth/current-user';
import { FacetasService, type FacetasDto } from './facetas.service';
import { FiltrosDto } from './job.dto';

/**
 * As contagens do modal de filtros (JOB-41).
 *
 * **POST, como a busca** — os filtros vao no corpo. Um GET com vinte eixos
 * repetidos daria uma URL de milhares de caracteres, e o `ValidationPipe` teria
 * de reconstruir tipo a partir de query string, onde tudo chega como texto.
 *
 * Rota **separada** da busca, e nao um campo a mais na resposta dela: o modal
 * pede contagem a cada clique, sem executar a busca. Junta-las faria toda
 * marcacao de chip disparar a cascata inteira de motores.
 *
 * `@SessaoOpcional()` e nao `@Public()`: filtrar e anonimo, como ler uma aula
 * (PLT-07). Mas token invalido continua dando 401 em vez de virar anonimo em
 * silencio — sessao expirada nao pode parecer catalogo vazio.
 */
@Controller('jobs/facets')
export class FacetasController {
  constructor(private readonly facetas: FacetasService) {}

  @Post()
  @SessaoOpcional()
  obter(@Body() filtros: FiltrosDto): Promise<FacetasDto> {
    return this.facetas.obter(filtros);
  }
}
