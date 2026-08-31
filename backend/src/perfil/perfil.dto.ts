import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PAISES } from './documentos';

const CODIGOS = PAISES.map((p) => p.codigo);

/** Apara a string, e trata "so espaco" como "quero apagar este campo". */
const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Corpo do `PUT /perfil`.
 *
 * **Os tres campos sao opcionais**, e string vazia significa apagar. Nada aqui
 * bloqueia quem nao quer preencher (PLT-10) — a validacao so entra quando ha
 * valor.
 *
 * O `ValidationPipe` global usa `forbidNonWhitelisted`: campo sem decorador
 * rejeita com 400, entao acrescentar um campo aqui exige acrescentar o
 * decorador junto.
 */
export class SalvarPerfilDto {
  @IsOptional()
  @Transform(aparar)
  @IsString()
  // A lista fechada e a primeira barreira: pais fora dela nem chega ao
  // servico, e sem isso um codigo qualquer viraria documento sem regra.
  @IsIn([...CODIGOS, ''], { message: 'Pais desconhecido' })
  country?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(24)
  // Digitos, espaco, parenteses, traco e o `+` do DDI. Nao se valida o numero
  // em si: plano de numeracao muda por pais e recusar telefone valido de quem
  // mora fora seria pior que aceitar um errado que ninguem disca hoje.
  @Matches(/^$|^\+?[\d\s().-]{6,24}$/, { message: 'Telefone em formato invalido' })
  phone?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(32)
  // A regra POR PAIS mora no servico, e nao aqui: ela depende do `country`
  // que veio no mesmo corpo, e um decorador de campo nao enxerga o vizinho.
  document?: string;
}

/**
 * O que `GET /perfil` e `PUT /perfil` devolvem.
 *
 * ⚠️ **Nao ha campo `document`.** O documento nunca volta para a tela, nem
 * parcialmente — o que volta e `documentHint`, os ultimos digitos, o mesmo
 * gesto do `hint` do ApiToken (PLT-01).
 */
export interface PerfilDto {
  country: string | null;
  phone: string | null;
  /** Os ultimos digitos do que esta guardado, ou `null` se nao ha documento. */
  documentHint: string | null;
  /**
   * De qual pais era o documento guardado.
   *
   * A tela compara com `country`: se diferem, o documento guardado nao vale
   * mais para onde a pessoa diz morar, e ela precisa digitar de novo.
   */
  documentCountry: string | null;
}

/** Um pais na lista que a tela desenha. */
export interface PaisDto {
  codigo: string;
  nome: string;
  ddi: string;
  documento: string;
  exemplo: string;
  /** Ha validacao real para este pais, ou ele cai no caminho generico? */
  validado: boolean;
}
