import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';
import type { Veredito } from './remoto-do-pais';

/** Uma pagina da lista tem 25 vagas (`POR_PAGINA` no front). E o teto por pedido. */
export const MAX_VAGAS_POR_PEDIDO = 25;

/**
 * As vagas que a pessoa esta vendo.
 *
 * So os ids: a descricao e buscada pelo SERVIDOR. Aceitar o texto do anuncio
 * vindo do navegador deixaria qualquer um gravar, no cache que todos leem, um
 * veredito sobre um texto que ele mesmo escreveu.
 */
export class VerificarRemotoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_VAGAS_POR_PEDIDO)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  ids!: string[];
}

export interface VereditoDto {
  /** O `id` da vaga, como veio no pedido. */
  id: string;
  veredito: Veredito;
  /** O trecho literal do anuncio. `null` em `nao_diz`. */
  trecho: string | null;
}

export interface RemotoDoPaisDto {
  /**
   * `ok` — verificou (ou tentou). `desligado` — o interruptor esta desligado
   * ou nao ha chave de IA: a tela fica com a resposta por campo. `sem_pais` —
   * a pessoa nao disse onde mora: a tela mostra como configurar.
   */
  estado: 'ok' | 'desligado' | 'sem_pais';
  /** O pais da pessoa, em ingles ("Brazil"), para o texto do selo. */
  pais: string | null;
  /**
   * So as vagas que TEM resposta. Vaga ausente daqui nao foi verificada (IA
   * fora, anuncio indisponivel) — nao e `nao_diz`, que e resposta.
   */
  vereditos: VereditoDto[];
}
