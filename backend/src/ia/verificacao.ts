import { ApiProvider } from '@prisma/client';

/**
 * O estado de uma chave de provedor, do ponto de vista de quem abre a tela.
 *
 * **`chave_recusada` e `sem_cota` sao separados de proposito.** Os dois vem de
 * uma chave que o provedor nao aceitou agora, e a cadeia trata os dois igual
 * (cai para o proximo) — mas a ACAO de quem le e oposta: um pede trocar a
 * chave, o outro pede adicionar credito. Um selo so mandaria metade dos
 * admins pelo caminho errado.
 *
 * `sem_chave` nao e resultado de verificacao: e ausencia, e nao chega a haver
 * chamada. Ele existe aqui porque a tela mostra os cinco estados na mesma
 * coluna, e o quinto (`verificando`) e do frontend — dura o tempo da
 * requisicao e nunca e gravado.
 */
export type StatusDaChave =
  /** Nao ha chave cadastrada nem no ambiente. Nao houve chamada. */
  | 'sem_chave'
  /**
   * Ha chave, e ela nunca foi verificada.
   *
   * **Nao e `erro`.** Chamar de erro faria a tela acusar uma chave que pode
   * estar perfeita — e o conserto sugerido (trocar a chave) seria o errado.
   * Acontece com chave cadastrada antes desta feature existir, e com chave
   * cuja verificacao ao salvar nao completou.
   */
  | 'nao_verificado'
  /** O provedor respondeu. E o unico estado que autoriza contar com ele. */
  | 'funcionando'
  /** 401/403 — a chave existe e o provedor a rejeitou. Troque a chave. */
  | 'chave_recusada'
  /** 429/402 — a chave e valida, a conta e que nao tem credito. Pague. */
  | 'sem_cota'
  /** Qualquer outra coisa: timeout, 500, DNS, resposta ilegivel. */
  | 'erro';

/**
 * Como um codigo HTTP vira estado de tela.
 *
 * A regra e a mesma que `ehChaveMorta` usa para decidir a queda na cadeia,
 * mas PARTIDA EM DOIS: 401 e 403 dizem "esta chave nao serve", 402 e 429
 * dizem "esta conta nao tem credito". A cadeia nao precisa da distincao — ela
 * cai igual nos dois. A tela precisa: as duas acoes de conserto sao
 * diferentes.
 *
 * `null` (sem resposta: timeout, DNS, conexao recusada) vira `erro`, e nao
 * `chave_recusada`: culpar a chave por uma rede fora do ar mandaria alguem
 * revogar uma chave boa.
 */
export function statusDoHttp(status: number | null): StatusDaChave {
  if (status === null) return 'erro';
  if (status === 401 || status === 403) return 'chave_recusada';
  if (status === 429 || status === 402) return 'sem_cota';
  if (status >= 200 && status < 300) return 'funcionando';
  return 'erro';
}

/**
 * A frase que a tela mostra abaixo do selo.
 *
 * **O motivo e a metade util do estado.** "Key refused" sozinho nao diz o que
 * fazer; "401 — API key is invalid. Revoked or mistyped." diz. O texto do
 * provedor entra cortado porque alguns devolvem um HTML inteiro de erro.
 *
 * Em ingles: e texto de interface (CLAUDE.md). O `detalhe` cru do provedor
 * vem no idioma que ele quiser, e por isso e mostrado como citacao e nao
 * costurado na frase.
 */
export function explicacao(
  status: StatusDaChave,
  httpStatus: number | null,
  detalhe: string,
): string {
  const codigo = httpStatus === null ? '' : `${httpStatus} — `;
  switch (status) {
    case 'chave_recusada':
      return `${codigo}API key is invalid. It was revoked or mistyped. Replace it below, or move a working provider above this one.`;
    case 'sem_cota':
      return `${codigo}the key is valid but the account has no credit. Add billing at the provider, or use a free provider instead.`;
    case 'erro':
      return httpStatus === null
        ? `No response from the provider: ${detalhe || 'connection failed or timed out'}. This may be temporary.`
        : `${codigo}unexpected response: ${detalhe || 'no details'}. This may be temporary.`;
    case 'nao_verificado':
      return 'This key has never been tested. Use Test all keys to find out whether it works.';
    case 'funcionando':
      return '';
    case 'sem_chave':
      return '';
  }
}

/** O resultado de uma verificacao, como sai do servico e entra no banco. */
export interface Verificacao {
  provider: ApiProvider;
  status: StatusDaChave;
  httpStatus: number | null;
  detalhe: string;
}

/**
 * Um `status` lido do banco de volta para o tipo.
 *
 * A coluna e `String` para o conjunto poder crescer sem migration, e o preco
 * disso e validar na leitura: uma linha gravada por uma versao futura nao
 * pode virar um estado que a tela nao sabe pintar.
 */
export function statusGravado(bruto: string): StatusDaChave {
  switch (bruto) {
    case 'funcionando':
    case 'chave_recusada':
    case 'sem_cota':
    case 'erro':
    case 'sem_chave':
    case 'nao_verificado':
      return bruto;
    default:
      return 'erro';
  }
}
