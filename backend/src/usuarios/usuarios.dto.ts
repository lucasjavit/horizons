import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Os papeis que a TELA pode atribuir.
 *
 * ⚠️ **`ADMIN` nao esta aqui, e e o ponto.** Quem decide o admin e
 * `ADMIN_EMAILS`, reavaliada a cada login (PLT-09); um botao na tela criaria
 * uma segunda fonte de verdade que o proximo login desfaz — a pessoa apareceria
 * como admin ate entrar de novo, e voltaria a ser comum sem erro nenhum.
 *
 * A lista fechada no `@IsIn` e a barreira: `{"role":"ADMIN"}` no corpo nem
 * chega ao servico, devolve 400.
 */
export const PAPEIS_ATRIBUIVEIS = ['COMMON_USER', 'MANAGER'] as const;

/** Quantos por pagina. Igual ao `POR_PAGINA` da tela de vagas. */
export const POR_PAGINA = 25;

/** Query de `GET /usuarios`. */
export class ListarUsuariosQueryDto {
  /**
   * Busca por e-mail ou nome, sem diferenciar maiuscula.
   *
   * `@IsOptional` e nao um default `''`: string vazia e "sem filtro", e as
   * duas formas precisam significar a mesma coisa — a tela manda o campo vazio
   * quando a pessoa apaga o que digitou.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /**
   * `@Type(() => Number)` e obrigatorio: a query chega como string, e sem a
   * conversao o `@IsInt` reprova tudo com 400.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // Teto de proposito: sem ele, `?pagina=1e9` faria um `skip` de um bilhao no
  // Postgres, que varre a tabela inteira antes de devolver zero linhas.
  @Max(10_000)
  pagina?: number;
}

/** Corpo do `PATCH /usuarios/:id/papel`. */
export class MudarPapelDto {
  @IsString()
  @IsIn([...PAPEIS_ATRIBUIVEIS], {
    message: 'Papel invalido. O papel de admin vem da variavel ADMIN_EMAILS.',
  })
  role!: string;
}

/** Corpo do `PATCH /usuarios/:id/ativo`. */
export class MudarAtivoDto {
  @IsBoolean()
  active!: boolean;
}

/**
 * Uma linha da lista.
 *
 * ⚠️ **Nao ha `document`, nem `documentHint`, nem endereco, nem telefone.**
 * Nada disso e buscado no `select:` do servico — o jeito mais seguro de nao
 * vazar um campo e nunca carrega-lo (PLT-11). Gerenciar papel nao precisa do
 * CPF de ninguem, e se um dia precisar (disputa, cobranca) e outro card, com o
 * motivo escrito.
 */
export interface UsuarioDaListaDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** "COMMON_USER" | "MANAGER" | "ADMIN". */
  role: string;
  active: boolean;
  /** ISO, como toda data que cruza a API. */
  createdAt: string;
  lastLoginAt: string | null;
  deactivatedAt: string | null;
  /**
   * Quem desativou, pelo nome — nao pelo id.
   *
   * O id nao responde a pergunta que a coluna existe para responder ("foi eu,
   * ou um manager?") sem uma segunda consulta na tela.
   */
  deactivatedByName: string | null;
  /**
   * Este e o proprio usuario da sessao?
   *
   * Vem do servidor e nao e deduzido na tela comparando ids: a tela ja tem o
   * `AuthUser`, mas quem sabe quais gestos sao proibidos e o backend, e repetir
   * a regra nos dois lados e como as duas versoes divergem.
   */
  isSelf: boolean;
  /**
   * Quem esta olhando pode desativar/reativar esta conta?
   *
   * Calculado no servidor pela mesma funcao que o `PATCH` usa para recusar —
   * uma fonte so, entao o botao nunca aparece para um gesto que dara 403.
   */
  canToggleActive: boolean;
  /** Quem esta olhando pode mudar o papel desta conta? (so ADMIN, e nao em si) */
  canChangeRole: boolean;
}

/** O que `GET /usuarios` devolve. */
export interface ListaDeUsuariosDto {
  itens: UsuarioDaListaDto[];
  /** Total que casa com o filtro — nao o total da tabela. */
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
}
