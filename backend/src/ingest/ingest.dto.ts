import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SemCaractereDeControle } from './sem-controle';

/**
 * Normaliza a metade da chave de idempotencia que e **nome de adaptador**
 * (JOB-54, defeito 4).
 *
 * ## O que estava acontecendo
 *
 * Medido em 06/10/2026: a MESMA vaga enviada com `greenhouse`, `Greenhouse`,
 * `GREENHOUSE`, `" greenhouse"` e `"greenhouse "` virou **5 linhas**. O unique
 * do Postgres e byte-exato, e nem o DTO nem o `paraBanco()` normalizavam nada.
 *
 * ## `trim` + `toLowerCase` no `fonte`, e a razao de ser so nele
 *
 * `fonte` e um identificador do NOSSO lado — o nome do adaptador do rastreador
 * (`greenhouse`, `lever`, `ashby`), escolhido em codigo, de um conjunto fechado
 * e conhecido. `Greenhouse` e `greenhouse` nao sao dois boards: sao a mesma
 * coisa escrita por duas maos. Dobrar a caixa aqui nao perde informacao nenhuma
 * e fecha a porta para o dia em que dois adaptadores escreverem diferente.
 *
 * `idExterno` leva **so `trim`**, nunca `toLowerCase`. Ver a razao no campo.
 */
function normalizarFonte(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : valor;
}

/**
 * `trim` sem `toLowerCase` — o espaco e acidente de transporte, a caixa e dado.
 *
 * O `idExterno` e o id da vaga **no ATS de origem**, e esse id nao e nosso: o
 * Lever usa uuid, o Ashby usa slug, e ha board que usa base64 (onde `A` e `a`
 * sao bytes diferentes e apontam para vagas diferentes). Dobrar a caixa dele
 * fundiria duas vagas reais numa linha — o oposto exato do bug que estamos
 * corrigindo, e pior, porque perderia dado em vez de duplicar.
 *
 * O `trim` e seguro porque espaco na borda de um id de ATS e ruido de parsing,
 * nunca conteudo. E ele tambem fecha o `idExterno: "   "`, que o
 * `@IsNotEmpty()` deixava passar: o decorador rejeita `""` mas nao espaco em
 * branco, e com o `trim` rodando ANTES da validacao os tres espacos viram `""`
 * e levam 400.
 */
function normalizarId(valor: unknown): unknown {
  return typeof valor === 'string' ? valor.trim() : valor;
}

/**
 * Quantos itens por lista, por chamada.
 *
 * **O teto existe por causa do corpo da requisicao, e os dois numeros tem de
 * conversar** — o card pede essa conferencia explicitamente. Medido em
 * 01/10/2026, com uma vaga realista (8 skills, 4 beneficios, snapshot com
 * salario e trecho):
 *
 * | Lote | Corpo |
 * | --- | --- |
 * | 200 vagas completas | **152,9 KB** |
 * | 200 referencias (so a chave) | 9,4 KB |
 * | as tres listas com 200 cada | **171,7 KB** |
 *
 * O body parser do Express aceita **102.400 bytes** por padrao
 * (`body-parser/lib/utils.js:62`), entao o lote cheio morreria com **413 antes
 * de o `ValidationPipe` ver este teto** — um erro que nao explica nada a quem
 * envia, e que nenhum ajuste deste numero resolveria sozinho.
 *
 * Por isso o `main.ts` sobe o limite do corpo para 2 MB (ver o comentario la):
 * 171,7 KB cabem com ~11x de folga, e o 413 deixa de ser alcancavel por um
 * lote que respeita este teto.
 *
 * As listas de id (`confirmar`, `fechar`) sao muito mais baratas — ~40 bytes
 * por item —, mas usam o mesmo teto: dois tetos diferentes seriam duas
 * conversas a manter com o rastreador, e 200 ja e lote grande para os dois
 * lados. Mais que isso, o rastreador pagina.
 */
export const ITENS_POR_LISTA = 200;

/**
 * Uma vaga completa, como o rastreador a entrega.
 *
 * **Os campos de conteudo sao os mesmos de `SalvarVagaDto`**, com duas
 * diferencas que valem a leitura:
 *
 * - `fonte` e `idExterno` sao **obrigatorios**: sao a chave de idempotencia.
 *   Opcionais, um lote sem eles viraria linha nova a cada envio.
 * - **nao ha campo de elegibilidade.** E deliberado: a elegibilidade e regra
 *   de produto do Horizons (JOB-49) e sai de `lerElegibilidade` sobre o
 *   `local` cru. Um campo aqui seria confianca em dado de terceiro, e com
 *   `forbidNonWhitelisted` o rastreador que tentar mandar `paisesElegiveis`
 *   leva 400 — o que e a resposta certa: ele nao decide isso.
 */
export class VagaRastreadaDto {
  /**
   * O adaptador de origem: `greenhouse`, `lever`, `ashby`.
   *
   * `@Transform` normaliza (trim + caixa baixa) **antes** da validacao, entao o
   * `@IsNotEmpty()` abaixo ja julga o valor normalizado — e o que grava e o
   * mesmo valor, porque o pipe usa `transform: true`.
   */
  @Transform(({ value }) => normalizarFonte(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @SemCaractereDeControle()
  fonte!: string;

  /**
   * O id da vaga no ATS de origem.
   *
   * `@IsNotEmpty()` e a metade que importa: string vazia passaria no
   * `@IsString()` e casaria com a proxima vaga sem id da mesma fonte — duas
   * vagas diferentes viravam uma linha, em silencio. Com o `trim` do
   * `@Transform` ele passou a pegar `"   "` tambem (JOB-54).
   */
  @Transform(({ value }) => normalizarId(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @SemCaractereDeControle()
  idExterno!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @SemCaractereDeControle()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @SemCaractereDeControle()
  company!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @SemCaractereDeControle()
  url!: string;

  /** Cidade/pais como o anuncio escreveu. **A entrada da elegibilidade.** */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @SemCaractereDeControle()
  local?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @SemCaractereDeControle()
  regime?: string;

  // ⚠️ **Sem `{ each: true }`, de proposito, e isso foi MEDIDO.** A primeira
  // versao usava `each`, e a mutacao que o removeu **nao matou teste nenhum**:
  // `@SemCaractereDeControle` varre recursivamente (ver `sem-controle.ts`),
  // entao ela ja desce no item do array sozinha. Manter o `each` era dizer no
  // codigo uma coisa que o codigo nao fazia — dois caminhos para o mesmo
  // resultado, e um deles decorativo.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @SemCaractereDeControle()
  skills?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @SemCaractereDeControle()
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
  @SemCaractereDeControle()
  benefits?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @SemCaractereDeControle()
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @SemCaractereDeControle()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  @SemCaractereDeControle()
  paisIso?: string;

  /**
   * Salario e os trechos de origem. **Sem elegibilidade** — o servico
   * sobrescreve o que o Horizons calculou, e o teste prova.
   */
  // O `snapshot` e o unico campo em que a varredura e RECURSIVA: ele e
  // `@IsObject()`, entao o rastreador poe o que quiser dentro, e o NUL passava
  // igual — chave ou valor, em qualquer nivel. Ver `sem-controle.ts`, inclusive
  // o teto de profundidade (a recursao nao pode virar a arma nova).
  @IsOptional()
  @IsObject()
  @SemCaractereDeControle()
  snapshot?: Record<string, unknown>;

  /**
   * ISO 8601, nunca string livre.
   *
   * Medido em 21/08 na rota de salvar: `"banana"` virava `Invalid Date` e
   * estourava 500 no Prisma, e `"01/08/2026"` era lido como 8 de JANEIRO e
   * gravava calado. Aqui o dado vem de outra aplicacao, onde ninguem ve o
   * resultado — corrupcao silenciosa seria pior.
   *
   * ⚠️ **`{ strict: true }`, e e isso que separa data invalida de data que nao
   * existe** (JOB-54, defeito 3). Sem a flag, o `validator` aceita dia fora do
   * mes e o `new Date()` do servico rola para o mes seguinte, calado. Sonda na
   * lib (06/10/2026):
   *
   * | Entrada | solto | `strict` | gravava |
   * | --- | --- | --- | --- |
   * | `2026-02-31` | aceita | **recusa** | `2026-03-03` |
   * | `2026-02-30` | aceita | **recusa** | `2026-03-02` |
   * | `2026-04-31` | aceita | **recusa** | `2026-05-01` |
   * | `2026-02-28` | aceita | aceita | `2026-02-28` |
   *
   * E reincidencia: o CLAUDE.md registra *"o RFC aceitando 31 de fevereiro"*
   * como bug achado em 31/08. O que o `strict` **nao** muda e o que ja dava 400
   * — `"banana"`, `"01/08/2026"`, mes 13, epoch numerico —, e ha teste de
   * regressao para cada um.
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  postedAt?: string;
}

/**
 * A referencia a uma vaga ja enviada: so a chave.
 *
 * Classe, e nao `string`, porque e o que o `@ValidateNested()` precisa para
 * validar o item. Uma lista de `string` com `@IsString({ each: true })`
 * funcionaria, mas obrigaria o rastreador a concatenar fonte e id numa string
 * — e todo separador escolhido aqui seria um caractere proibido no id do ATS.
 */
export class ReferenciaDeVagaDto {
  /**
   * ⚠️ **A normalizacao tem de ser a MESMA do `VagaRastreadaDto`**, e nao e
   * duplicacao gratuita: as duas sao a chave `(fonte, idExterno)`. Se o
   * `upsert` dobrasse a caixa e o `confirmar` nao, o rastreador gravaria
   * `greenhouse` e depois tentaria confirmar `Greenhouse` — `updateMany` casaria
   * **zero** linhas, devolveria `confirmadas: 0`, e a vaga morreria no prazo de
   * 7 dias enquanto o ATS dizia que ela estava aberta. Falha silenciosa e com
   * uma semana de atraso.
   */
  @Transform(({ value }) => normalizarFonte(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @SemCaractereDeControle()
  fonte!: string;

  // O NUL aqui tambem derrubava o Postgres — o card mediu o 500 vindo de
  // `updateMany`/`deleteMany`, e nao so do `upsert`.
  @Transform(({ value }) => normalizarId(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @SemCaractereDeControle()
  idExterno!: string;
}

/**
 * O lote que o rastreador envia: tres listas, um POST.
 *
 * **As tres juntas e nao tres rotas** porque o rastreador descobre as tres
 * coisas na MESMA passada por um board (vaga nova, vaga que continua la, vaga
 * que sumiu), e dividir obrigaria a coordenar tres respostas para tirar um
 * board da fila.
 *
 * ⚠️ **`@ValidateNested({ each: true })` + `@Type(() => X)` nas tres, e as
 * duas sao necessarias.** O `ValidationPipe` global usa `whitelist` com
 * `forbidNonWhitelisted`:
 *
 * - **sem `@ValidateNested`**, os decoradores de dentro de `VagaRastreadaDto`
 *   nunca rodam: um `idExterno` vazio ou um `postedAt: "banana"` entrariam —
 *   e isso passa com 201, em silencio. **E este o caminho perigoso dos dois.**
 * - **sem `@Type`**, o `class-transformer` nao sabe em que classe transformar
 *   o item e o `@ValidateNested` nao tem o que validar.
 *
 * ## O que foi MEDIDO aqui, e diverge do que o card supoe (01/10/2026)
 *
 * O card previa que a falta de `@Type` fosse o pior caso — *"passa sem
 * validar"*, com o `whitelist` apagando os campos do item e gravando vazio com
 * 200. **Nao e o que acontece nesta versao** (class-validator 0.15,
 * class-transformer 0.5). Sonda direta, so com `@ValidateNested` e sem `@Type`:
 *
 * ```
 * ComType -> erros: 0  {"itens":[{"id":"abc"}]}
 * SemType -> erros: 1  {"itens":[{"id":"abc"}]}
 * ```
 *
 * O objeto **nao** e esvaziado (os campos continuam la), e a validacao falha
 * ALTO: a rota responde 400 para todo lote, inclusive o valido. Na suite, a
 * mutacao que removeu os `@Type` reprovou 22 dos 39 testes.
 *
 * Isso **nao** torna o `@Type` dispensavel — sem ele nenhum lote entra —, mas
 * inverte o risco: a falta de `@Type` quebra ruidosamente, e quem silencia e a
 * falta de `@ValidateNested`. O teste `o item do lote E validado` e o que
 * guarda essa metade.
 */
export class LoteDeIngestaoDto {
  /** Vaga completa: grava por `(fonte, idExterno)` e confirma. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ITENS_POR_LISTA)
  @ValidateNested({ each: true })
  @Type(() => VagaRastreadaDto)
  upsert?: VagaRastreadaDto[];

  /** So a chave: a vaga continua aberta, atualiza `confirmadaEm`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ITENS_POR_LISTA)
  @ValidateNested({ each: true })
  @Type(() => ReferenciaDeVagaDto)
  confirmar?: ReferenciaDeVagaDto[];

  /** So a chave: a vaga fechou, **apaga** a linha. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ITENS_POR_LISTA)
  @ValidateNested({ each: true })
  @Type(() => ReferenciaDeVagaDto)
  fechar?: ReferenciaDeVagaDto[];
}

/**
 * O que o rastreador recebe de volta.
 *
 * **E com isto que ele tira os itens da fila** (JOB-49, decisao 9: o unico
 * retorno do Horizons e "recebi este lote"). Por isso os numeros sao o que
 * FOI APLICADO, e nao o que foi enviado — um `gravadas` menor que o
 * `upsert.length` e informacao, nao ruido.
 *
 * `fechadas` conta as linhas que EXISTIAM e sairam. Pedir para fechar um id
 * que nao esta aqui e **sucesso** — reenvio de lote e o caso normal —, e a
 * diferenca entre `fechar.length` e `fechadas` e so quantas ja tinham ido.
 */
export interface ResultadoDaIngestaoDto {
  /** Quantas vagas do `upsert` foram gravadas (criadas ou atualizadas). */
  gravadas: number;
  /** Quantas do `confirmar` tinham linha e tiveram `confirmadaEm` atualizado. */
  confirmadas: number;
  /** Quantas do `fechar` existiam e foram apagadas. */
  fechadas: number;
}
