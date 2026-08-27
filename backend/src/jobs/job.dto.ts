import { Transform, Type } from 'class-transformer';
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
  Max,
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

  // ————————————————————————————————————————————————————————————————
  // Os eixos do modal de filtros avancados (JOB-41).
  //
  // **Nenhum deles tem `@IsIn` com lista escrita a mao**, e isso e
  // deliberado: o vocabulario vive em `/api/v1/jobs/facets` e muda sem
  // aviso. Uma lista fixa aqui viraria 400 no dia em que eles renomeassem
  // um valor, e o `ValidationPipe` rejeitaria uma busca que a API atenderia
  // sem problema.
  //
  // O tamanho e limitado porque a URL da consulta tem teto pratico, e
  // porque 20 valores num eixo ja e mais do que alguem escolhe a mao.
  // ————————————————————————————————————————————————————————————————

  // **Os eixos do modal NAO reusam os campos escalares da barra.**
  //
  // Medido pelo QA em 26/08: o modal e multi-selecao (marcar Brasil E Mexico),
  // e a barra e de um valor so (`regiao?: string`). Mandar lista num campo
  // escalar dava **400** em 7 das 22 secoes, e o erro voltava para a tela como
  // "filtros indisponiveis" — o defeito se disfarcava de motor fora do ar.
  //
  // E nao e so cardinalidade: `employment_types` da barra tem `@IsIn` com
  // `clt, pj, contractor, freelance` (vocabulario de contrato brasileiro), e a
  // faceta do freehire fala `full_time, contract, internship`. Sao listas
  // diferentes com o mesmo nome — reusar o campo faria uma validar a outra.
  //
  // Por isso cada eixo do modal tem campo proprio, no plural, sem `@IsIn`.

  /** Regioes do modal. Multi, ao contrario de `regiao` — ver a nota acima. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  regions?: string[];

  /** Regimes do modal (`work_mode`). Multi, ao contrario de `remote`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  work_modes?: string[];

  /** Senioridades do modal. Multi, ao contrario de `seniority`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  seniorities?: string[];

  /** Moedas do modal. Multi, ao contrario de `currency`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(3, { each: true })
  currencies?: string[];

  /**
   * Contratos no vocabulario do freehire (`full_time`, `contract`).
   *
   * Separado de `employment_types`, que e o vocabulario brasileiro da barra.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  employment_kinds?: string[];

  /**
   * Patrocinio de visto, como lista.
   *
   * `['true']` / `['false']`, e nao booleano: o chip e um valor da faceta como
   * qualquer outro, e tratar este eixo diferente dos vizinhos era o que fazia
   * o modal mandar `visa_sponsorship: ['false']` num campo booleano.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  visa_sponsorships?: string[];

  /** Foco de IA (`ai_archetype`). Vocabulario proprio, nao e `domains`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  ai_archetypes?: string[];

  /** Fontes a INCLUIR (`source`). O par de `sources_exclude`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  sources?: string[];

  /** Cargos canonicos (`role`). Nao confundir com `job_titles`, que e texto livre. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  roles?: string[];

  /** Familia do cargo (`category`): backend, frontend, devops… */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categories?: string[];

  /** Paises, ISO-3166 alpha-2 minusculo. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2, { each: true })
  countries?: string[];

  /** Cidades, pelo nome de exibicao que a faceta usa. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  cities?: string[];

  /** Porte da empresa (`company_size`): `1-10`, `11-50`, `1000+`… */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  company_sizes?: string[];

  /** Tipo de empresa (`company_type`): product, outsource, startup… */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  company_types?: string[];

  /** Setor (`domains`): fintech, devtools, healthcare… */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  domains?: string[];

  /** Listas curadas (`collections`): yc, unicorn, fortune500… */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  collections?: string[];

  /** Nivel de ingles exigido (`english_level`): a2, b1, b2, c1, c2, native. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  english_levels?: string[];

  /** Idioma do anuncio (`posting_language`), ISO-639-1. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  posting_languages?: string[];

  /** Escolaridade (`education_level`): none, bachelor, master, phd. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  education_levels?: string[];

  /** Mudanca de pais (`relocation`): not_supported, supported, required. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  relocation?: string[];

  /**
   * Frescor do anuncio (`reality`): fresh, stale, likely.
   *
   * O nome da faceta e deles e diz mais que "data de publicacao": marca vaga
   * que provavelmente ainda esta aberta contra a que so nao foi removida.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  reality?: string[];

  /** A vaga patrocina visto? `true`/`false` da faceta `visa_sponsorship`. */
  @IsOptional()
  @IsBoolean()
  visa_sponsorship?: boolean;

  /** Anos de experiencia pedidos, piso e teto. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  experience_years_min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  experience_years_max?: number;

  // ————— As exclusoes —————
  //
  // **O terceiro estado do chip.** A referencia cicla off → incluir →
  // excluir → off, e a API sustenta: `<facet>_exclude` vale para toda faceta
  // de texto, conforme a spec deles e medido em 26/08 (`skills_exclude=python`
  // levou 14.976 para 9.530).
  //
  // Sao campos SEPARADOS, e nao um valor com prefixo `-` dentro da mesma
  // lista: prefixo obrigaria a inventar escape para o valor que comeca com
  // hifen, e um dia haveria uma skill assim.

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  skills_exclude?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2, { each: true })
  countries_exclude?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  regions_exclude?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  work_mode_exclude?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  company_types_exclude?: string[];

  /** Excluir vaga vinda de uma fonte (`source`) — "nao confio nesse board". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  sources_exclude?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  roles_exclude?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categories_exclude?: string[];
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


/**
 * Guardar uma busca do modal (JOB-41).
 *
 * `filtros` e objeto livre e nao um `FiltrosDto` aninhado: o que se guarda e o
 * que a tela montou, e ele volta pela rota de busca — onde o `ValidationPipe`
 * o valida de verdade. Validar aqui tambem faria a mesma regra existir em dois
 * lugares, e elas divergiriam.
 */
export class SalvarBuscaDto {
  // **`Transform` antes de `IsNotEmpty`**: sem ele, `"   "` passa na validacao
  // e e gravado como string vazia (QA, 26/08) — a busca vira uma linha sem
  // texto clicavel, so com o botao de apagar, e o `aria-label` fica truncado
  // em "Delete saved filter ". O trim aqui deixa `IsNotEmpty` ver o que
  // sobrou, e nao o que foi digitado.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome!: string;

  @IsOptional()
  @IsObject()
  filtros?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  porEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  porTelegram?: boolean;
}

/**
 * Pedir a proxima pagina de uma sessao de busca (JOB-45).
 *
 * Um campo so, e de proposito: os filtros ja estao GRAVADOS na sessao. Reenvia-
 * los pela rede deixaria a tela mandar um conjunto e o cache guardar outro — e
 * a pagina 2 viria de um filtro que ninguem escolheu, com vagas plausiveis
 * demais para alguem notar.
 */
export class MaisVagasPedidoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessao!: string;
}

/** Ligar ou desligar os canais de alerta de uma busca salva. */
export class CanaisDaBuscaDto {
  @IsBoolean()
  porEmail!: boolean;

  @IsBoolean()
  porTelegram!: boolean;
}

export interface BuscaSalvaDto {
  id: string;
  nome: string;
  filtros: Record<string, unknown>;
  porEmail: boolean;
  porTelegram: boolean;
  createdAt: string;
}
