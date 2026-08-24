import { IsBoolean, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CADENCIAS, type Cadencia } from './email.service';

/**
 * O token do link de um clique.
 *
 * DTO com classe, e nao `@Query('t')` solto: o `ValidationPipe` so valida o
 * que tem classe, e sem isto um `t` ausente chegaria como `undefined` ao
 * servico. E o mesmo motivo do `RemoverSalvaDto` (JOB-05), onde a falta do
 * parametro apagava a lista inteira.
 *
 * O teto de tamanho existe porque o token tem 64 caracteres: qualquer coisa
 * muito maior e alguem sondando, e nao um link nosso.
 */
export class TokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  t!: string;
}

export class DefinirCadenciaDto {
  @IsIn(CADENCIAS)
  cadencia!: Cadencia;
}

export class DefinirAtivoDto {
  @IsBoolean()
  ativo!: boolean;
}

/**
 * A assinatura, como a tela a ve.
 *
 * **Sem o token.** Ele e a credencial dos links de um clique; devolve-lo numa
 * resposta de API o espalharia por log de proxy e historico do navegador sem
 * necessidade — a tela nunca precisa dele, porque ali a pessoa ja tem sessao.
 */
export interface AssinaturaDto {
  id: string;
  /** "semanal" ou "mensal". */
  cadencia: string;
  ativo: boolean;
  ultimoEnvioEm: string | null;
  /** Quando clicou em "consegui a vaga". Nulo = nunca clicou. */
  contratadoEm: string | null;
}

/** O que uma rodada de envio fez. */
export interface ResultadoRodadaDto {
  considerados: number;
  enviados: number;
  /**
   * Sem vaga nova, fora da cadencia, conta inativa, ou provedor que nao
   * entrega. Todos sao "nao mandei", e nenhum e erro.
   */
  pulados: number;
  falhas: number;
  provedor: string;
  /** O provedor entrega de verdade? Com `false`, `enviados` sera sempre 0. */
  provedorEntrega: boolean;
  /**
   * Quantas mensagens sairam pelo Telegram (JOB-32).
   *
   * Contador proprio, e nao somado a `enviados`: os canais falham de forma
   * independente, e um numero unico esconderia "o e-mail nao saiu para
   * ninguem" atras do Telegram ter saido.
   */
  enviadosTelegram: number;
  /** O canal do Telegram entrega? `false` sem TELEGRAM_BOT_TOKEN. */
  provedorTelegramEntrega: boolean;
}

/** A metrica que o admin ve (JOB-25). */
export interface MetricasEmailDto {
  assinantes: number;
  ativos: number;
  /** **Quantas pessoas o Horizons empregou.** */
  contratados: number;
  emCadenciaMensal: number;
  jaReceberamAlgum: number;
  provedor: string;
  provedorEntrega: boolean;
  /**
   * **A taxa de vinculacao do Telegram** — o numero que o JOB-32 existe para
   * produzir, e o que decide se vale investir mais no canal.
   */
  telegramVinculados: number;
  /** Dos vinculados, quantos ainda recebem (o resto bloqueou o bot). */
  telegramAtivos: number;
  /** O canal esta ligado no servidor? */
  telegramLigado: boolean;
}
