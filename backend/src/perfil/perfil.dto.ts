import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PAISES } from './documentos';

const CODIGOS = PAISES.map((p) => p.codigo);

/** Apara a string, e trata "so espaco" como "quero apagar este campo". */
const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * O endereco de cobranca no corpo do `PUT`.
 *
 * **Um objeto aninhado, e nao oito campos soltos no corpo.** Nao e estetica:
 * e o que permite distinguir "nao mexi no endereco" (`address` ausente) de
 * "quero apagar o endereco" (`address` presente com os campos vazios) — a
 * mesma distincao que o QA cobrou no documento em 31/08, quando "Not set"
 * deixava o documento orfao. Com oito campos soltos, a regra
 * `corpo.campo !== undefined` teria de ser escrita oito vezes.
 *
 * **Todos opcionais, inclusive entre si.** Endereco pela metade e valido:
 * a obrigatoriedade mora no card da compra, nao aqui.
 *
 * A validacao de conteudo (alfabeto e comprimento) mora em `endereco.ts` e
 * roda no servico — aqui so o teto de tamanho, que e barreira de entrada.
 */
export class EnderecoDto {
  // ⚠️ **Nao ha `@MaxLength` aqui, e e de proposito.** O comprimento e
  // conferido no servico, por `validarTextoDeEndereco`.
  //
  // O motivo e a mensagem. Num DTO ANINHADO o Nest prefixa o erro com o
  // caminho — `"address.city must be shorter than or equal to 80 characters"`
  // —, e o prefixo sobrevive ate a um `message:` proprio: sai
  // `"address.City is too long"` (medido, 31/08). Isso vaza o nome do campo da
  // API para quem so queria encurtar o nome da cidade, e faz o erro deixar de
  // comecar pelo rotulo, que e como a tela decide se ele pertence ao endereco
  // ou ao documento — pendurando `aria-invalid` no input errado.
  //
  // Trocar o `exceptionFactory` do `ValidationPipe` global resolveria, mas ele
  // e de todos os modulos: mudar o formato de erro da API inteira por causa de
  // sete campos e desproporcional.
  @IsOptional()
  @Transform(aparar)
  @IsString()
  street?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  number?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  complement?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  district?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  state?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  postalCode?: string;

  @IsOptional()
  @Transform(aparar)
  @IsString()
  // Mesma lista fechada do `country`, e pelo mesmo motivo: codigo qualquer
  // viraria rotulo vazio na tela. `''` apaga.
  @IsIn([...CODIGOS, ''], { message: 'Pais do endereco desconhecido' })
  country?: string;
}

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

  // `@Type` e obrigatorio: sem ele o class-transformer entrega um objeto cru,
  // o `@ValidateNested` nao acha os decoradores de dentro e o endereco entra
  // SEM validacao nenhuma — falha silenciosa, que e a pior.
  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoDto)
  address?: EnderecoDto;
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
  /**
   * O endereco de cobranca. **Volta inteiro**, ao contrario do documento.
   *
   * Nao ha `hint` aqui porque nao ha o que esconder: o endereco e guardado em
   * claro (decisao de 31/08 — ver o card), entao a tela mostra o que a pessoa
   * digitou e ela edita em cima. Esconde-lo daria o trabalho da cifra sem
   * nenhuma das garantias dela.
   */
  address: EnderecoSalvoDto;
}

/** O endereco como ele volta. Todo campo pode ser `null`. */
export interface EnderecoSalvoDto {
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
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
