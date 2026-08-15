import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Senioridades aceitas. Uniao de string, nao enum: o front proibe enum de TS. */
export const SENIORIDADES = [
  'estagio',
  'junior',
  'pleno',
  'senior',
  'staff',
  'principal',
] as const;

/** Regimes de trabalho. */
export const REMOTOS = ['remoto', 'hibrido', 'presencial'] as const;

/** Vinculos. */
export const CONTRATOS = ['clt', 'pj', 'contractor', 'freelance'] as const;

/**
 * Filtros da busca.
 *
 * Os nomes sao os que o prompt de busca espera (`job_titles`, `salary_min`…),
 * e nao camelCase: mudar aqui obrigaria a traduzir na hora de montar o prompt,
 * e traducao de nome de campo e onde erro de digitacao vira busca silenciosa.
 *
 * **Todos opcionais** — da para cadastrar so com CV, so com filtros, ou os
 * dois. Os tetos de tamanho existem porque isto vai inteiro para dentro de um
 * prompt: lista sem limite e um jeito barato de inflar a conta da IA.
 */
export class FiltrosDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  job_titles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  exclude_keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  locations?: string[];

  @IsOptional()
  @IsIn(REMOTOS)
  remote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(CONTRATOS, { each: true })
  employment_types?: string[];

  @IsOptional()
  @IsIn(SENIORIDADES)
  seniority?: string;

  // Em unidade inteira da moeda (nao centavo): salario anunciado e sempre
  // redondo, e centavo aqui so daria falsa precisao.
  @IsOptional()
  @IsInt()
  @Min(0)
  salary_min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salary_max?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  posted_within_days?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  technologies?: string[];

  @IsOptional()
  @IsBoolean()
  visa_required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  timezone?: string;
}

/**
 * O que fica guardado do CV. **Nunca o arquivo nem o texto bruto.**
 *
 * Some o CPF, o endereco e o telefone: token se revoga, CPF nao.
 */
export class CvProfileDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  stack?: string[];

  @IsOptional()
  @IsIn(SENIORIDADES)
  senioridade?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  anos?: number;
}

export class SalvarPerfilDto {
  @ValidateNested()
  @Type(() => FiltrosDto)
  filtros!: FiltrosDto;

  /**
   * O perfil lido do CV, ja revisado pela pessoa na tela.
   *
   * Vem do cliente de proposito: a extracao acontece numa chamada separada
   * (`POST /jobs/cv`), a pessoa **corrige o que veio errado** e so entao
   * salva. Um CV lido errado que produz busca ruim, sem ela ver o porque, e o
   * pior desfecho possivel.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CvProfileDto)
  cvProfile?: CvProfileDto;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

/** Resposta com o perfil. */
export interface JobProfileDto {
  id: string;
  filtros: Record<string, unknown>;
  cvProfile: Record<string, unknown> | null;
  /** Assinatura dos filtros. Exposta para a tela poder explicar o agrupamento. */
  grupo: string;
  ativo: boolean;
  updatedAt: string;
}

/** O que a leitura do CV devolve, antes de a pessoa revisar e salvar. */
export interface CvLidoDto {
  cvProfile: {
    stack: string[];
    senioridade: string | null;
    anos: number | null;
  };
  /** Filtros sugeridos a partir do CV — a pessoa edita antes de salvar. */
  filtrosSugeridos: Record<string, unknown>;
}

/**
 * Uma vaga na lista.
 *
 * Os campos que a IA pode ter errado vem com o trecho de origem ao lado
 * (`salaryTrecho`, `elegibilidadeTrecho`): a tela mostra o texto do anuncio
 * sob demanda, e isso e verificavel — nao e confianca.
 *
 * `null` e resposta legitima em todo campo opcional. Campo ausente permanece
 * ausente; a tela escreve "nao informado" em vez de inventar.
 */
export interface VagaDto {
  id: string;
  title: string;
  company: string;
  url: string;
  local: string | null;
  /** Dominio de origem. Mostrar a fonte deixa a pessoa calibrar a confianca. */
  fonte: string | null;
  regime: string | null;
  skills: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  /** O texto do anuncio de onde o salario saiu. */
  salaryTrecho: string | null;
  elegivelBrasil: boolean | null;
  elegibilidadeTrecho: string | null;
  postedAt: string | null;
  foundAt: string;
}
