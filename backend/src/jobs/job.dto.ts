import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
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

/**
 * Regioes que a busca sabe expandir.
 *
 * So `latam` por enquanto: e a que interessa a quem procura do Brasil, porque
 * uma vaga aberta a America Latina costuma nao exigir mudanca de pais nem
 * cruzar mais de duas horas de fuso. Regiao nova aqui pede a lista de termos
 * correspondente em `TERMOS_REGIAO` (busca.service.ts).
 */
export const REGIOES = ['latam'] as const;

/**
 * De que lado do mercado procurar.
 *
 * Medido em 19/08: empresa da curadoria rende 1 vaga elegivel em 1.961;
 * startup dos slugs brutos rende 144 em 1.229. Sao mercados diferentes, e
 * quem procura de fora quer quase sempre o segundo.
 */
export const PORTES = ['grande', 'startup'] as const;

/**
 * Paises cuja sede o catalogo conhece (`empresas-sede.yaml`).
 *
 * Serve ao filtro "empresa do meu pais contratando para fora" — a Stefanini
 * brasileira abrindo vaga para os EUA.
 */
export const SEDES = ['BR', 'AR', 'MX', 'CO', 'IN'] as const;

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

  /**
   * Uma regiao inteira, e nao um pais.
   *
   * Separado de `locations` porque nao e um lugar que se escreva na consulta:
   * "LATAM" literal acha so quem usa a sigla, e perde o anuncio que diz "Latin
   * America" ou "South America" — a mesma vaga. Quem expande e o
   * `montarConsulta`.
   */
  @IsOptional()
  @IsIn(REGIOES)
  regiao?: string;

  @IsOptional()
  @IsIn(PORTES)
  porte?: string;

  /**
   * So vagas de empresa DESTE pais, e que sejam para trabalhar em outro.
   *
   * Promete cliente estrangeiro, nao moeda forte: outsourcing daqui contrata
   * em real para alocar la fora, e so a descricao separa os dois casos.
   */
  @IsOptional()
  @IsIn(SEDES)
  sede_no_pais?: string;

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

/**
 * O que a tela manda ao clicar na estrela.
 *
 * E a vaga inteira, e nao so a URL: o retrato tem de ser gravado no momento em
 * que ela salva, porque o anuncio sai do ar em semanas e e justamente o que
 * ela vai querer reler. Buscar de novo depois nao funcionaria.
 *
 * O `ValidationPipe` global usa `forbidNonWhitelisted`, entao todo campo que a
 * tela envia precisa estar aqui — inclusive os que so voltam para ela.
 */
export class SalvarVagaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company!: string;

  /** Chave da vaga. Vazia chegaria ao `deleteMany` e apagaria a lista toda. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  local?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fonte?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  regime?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  anosExp?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  benefits?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  paisIso?: string;

  /**
   * Salario, elegibilidade e os trechos de origem.
   *
   * Vem como objeto solto porque e o retrato — o que torna a afirmacao
   * conferivel depois que a pagina sumir (JOB-09).
   */
  @IsOptional()
  @IsObject()
  snapshot?: Record<string, unknown>;

  /**
   * Datas em ISO 8601, e nao string livre.
   *
   * Medido pelo QA em 21/08: `"banana"` virava `Invalid Date` e estourava 500
   * no Prisma, e `"01/08/2026"` era lido como 8 de JANEIRO (mes/dia dos EUA) e
   * gravava calado — corrupcao silenciosa, que e pior que o erro.
   */
  @IsOptional()
  @IsISO8601()
  postedAt?: string;

  @IsOptional()
  @IsISO8601()
  foundAt?: string;
}

/**
 * A query do `DELETE /jobs/saved`.
 *
 * DTO e nao `@Query('url')` solto porque o `ValidationPipe` so valida o que
 * tem classe: sem isto, `url` ausente chegava como `undefined` ao Prisma e
 * apagava a lista inteira (medido em 21/08).
 */
export class RemoverSalvaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  url!: string;
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
  /** Area/familia do cargo, como o anuncio escreveu. */
  area: string | null;
  /** Anos de experiencia pedidos. Nulo e o caso comum. */
  anosExp: number | null;
  benefits: string[];
  degree: string | null;
  /** Logo da empresa. A tela cai nas iniciais quando falta. */
  logoUrl: string | null;
  /** ISO-3166 alpha-2, para a bandeirinha. */
  paisIso: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  /** O texto do anuncio de onde o salario saiu. */
  salaryTrecho: string | null;
  /**
   * De onde a vaga aceita candidato, como o anuncio escreveu.
   *
   * Substituiu `elegivelBrasil: boolean` em 20/08. O booleano perguntava
   * "aceita quem mora no Brasil?" quando o alvo do produto passou a ser pais
   * emergente — a India tem 291 empresas no catalogo contra 110 do Brasil
   * (JOB-19). E ele apagava a distincao que mais importa: "worldwide" e
   * "contrata na LATAM" viravam o mesmo `true`.
   *
   * `null` continua sendo resposta legitima e diferente de lista vazia:
   * **"nao disse" nao e "nao aceita"**. Lista vazia seria lida como "nao
   * aceita ninguem", que e uma afirmacao que nenhum anuncio faz.
   */
  paisesElegiveis: string[] | null;
  /** A vaga aceita de qualquer lugar, sem restricao geografica. */
  elegivelGlobal: boolean;
  elegibilidadeTrecho: string | null;
  postedAt: string | null;
  foundAt: string;
}

/**
 * Marcar uma vaga como vista ou descartada (JOB-26).
 *
 * Carrega titulo e empresa junto com a URL porque a vaga pode nem existir no
 * banco: a busca e ao vivo e streama para a tela sem gravar `FoundJob`. Sem
 * estes dois campos, a lista de descartadas seria uma lista de URLs cruas, e
 * a pessoa nao teria como reconhecer o que desfazer.
 */
export class MarcarVagaDto {
  /** Chave da vaga. Vazia chegaria ao `deleteMany` e apagaria o historico. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  url!: string;

  @IsIn(['visto', 'descartado'])
  estado!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company!: string;
}

/** Tirar a vaga do historico — o desfazer do descarte. */
export class DesmarcarVagaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  url!: string;
}

/** Uma vaga descartada, com o minimo para a pessoa reconhece-la. */
export interface VagaMarcadaDto {
  url: string;
  title: string;
  company: string;
  marcadaEm: string;
}

/**
 * O historico inteiro da pessoa, numa resposta so.
 *
 * As vistas sao so URLs (a tela ja tem os dados da vaga na lista de busca); as
 * descartadas trazem titulo e empresa, porque elas somem da lista e precisam
 * ser mostradas em outro lugar para poderem voltar.
 */
export interface HistoricoDto {
  vistas: string[];
  descartadas: VagaMarcadaDto[];
}
