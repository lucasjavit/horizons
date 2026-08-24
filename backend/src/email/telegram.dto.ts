/**
 * DTOs do canal Telegram (JOB-32).
 *
 * Nao ha DTO de ENTRADA com class-validator aqui, e isso e uma decisao — ver
 * `TelegramUpdate` no fim do arquivo.
 */

/** O que a tela precisa saber sobre o canal. Sem token: ele e credencial. */
export interface TelegramStatusDto {
  /**
   * O canal esta configurado no servidor (token do bot + username)?
   *
   * `false` faz a opcao **nao aparecer** na tela — criterio do card. A tela
   * nao mostra um controle que falharia no clique.
   */
  disponivel: boolean;
  /** Esta conta ja passou pelo START? */
  vinculado: boolean;
  /** @username de quem vinculou, para a tela dizer qual conta esta ligada. */
  username: string | null;
  /** Recebendo mensagens? `false` com `vinculado` true = bot bloqueado. */
  ativo: boolean;
}

/**
 * O deep link que a tela abre.
 *
 * **Devolve a URL montada, e nao o token.** O token viaja dentro dela porque o
 * Telegram exige que a pessoa o carregue, mas nao existe campo `token` em
 * resposta de API nenhuma — a mesma regra do token do JOB-24.
 */
export interface TelegramVinculoDto {
  url: string;
  /** Quando o convite deixa de valer, para a tela poder oferecer outro. */
  expiraEm: string;
}

/**
 * O update do Telegram, como ele chega no webhook.
 *
 * **Por que NAO e uma classe com class-validator, e por que isso e o certo
 * aqui.**
 *
 * O `ValidationPipe` global usa `forbidNonWhitelisted`, entao todo campo sem
 * decorador **rejeita a requisicao com 400**. Isso e otimo para os corpos que
 * os nossos proprios clientes mandam: um campo a mais e um erro nosso, e falhar
 * alto e melhor que ignorar em silencio.
 *
 * Aqui e o oposto. O objeto `Update` do Telegram e grande, variavel e **de
 * outra pessoa**: o Telegram acrescenta campos a cada versao da Bot API, sem
 * nos avisar, e uma mensagem qualquer ja carrega dezenas deles
 * (`entities`, `link_preview_options`, `sender_chat`, `via_bot`,
 * `message_thread_id`, `business_connection_id`, `reply_to_message` inteiro
 * aninhado...). Um DTO que cobrisse menos do que o Telegram manda faria a
 * **mensagem legitima tomar 400** — o bot ficaria mudo, e o log mostraria uma
 * rejeicao de validacao em vez de um erro de integracao. E o unico jeito de
 * "cobrir tudo" seria reescrever a Bot API inteira e mante-la atualizada para
 * sempre, o que quebraria no dia em que o Telegram acrescentasse um campo.
 *
 * Entao o controller recebe o corpo **cru** (`@Body()` sem tipo de classe, que
 * o pipe deixa passar) e este arquivo valida a mao, com `lerUpdate` abaixo:
 * le so os quatro campos que a feature usa e ignora todo o resto, sem se
 * importar com o que mais venha junto.
 *
 * Isso NAO e confiar no payload — e o contrario. A validacao aqui e mais
 * restritiva que a do pipe: cada campo e checado por tipo, o texto tem teto de
 * tamanho, e o que nao casar com `/start <token>` e descartado sem tocar no
 * banco. O que protege a rota de quem nao e o Telegram tambem nao seria o
 * pipe: e o `secret_token` conferido antes de qualquer processamento.
 */
export interface TelegramUpdate {
  /** O `chat_id`, que e o endereco de entrega. */
  chatId: bigint;
  /** O texto da mensagem, ja aparado. */
  texto: string;
  /** @username de quem mandou, quando existe. */
  username: string | null;
}

/** Teto do texto que aceitamos ler. O `/start` tem menos de 80 caracteres. */
const MAX_TEXTO = 4096;

/**
 * Le o que interessa de um update cru, ou `null` se nao for uma mensagem de
 * texto utilizavel.
 *
 * Deliberadamente tolerante com o que nao conhece e rigorosa com o que usa:
 * campo a mais nao atrapalha, campo com tipo errado descarta o update inteiro.
 */
export function lerUpdate(corpo: unknown): TelegramUpdate | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const update = corpo as Record<string, unknown>;

  const message = update.message;
  if (!message || typeof message !== 'object') return null;
  const msg = message as Record<string, unknown>;

  const chat = msg.chat;
  if (!chat || typeof chat !== 'object') return null;
  const chatObj = chat as Record<string, unknown>;

  // O `chat_id` chega como number no JSON. Vira BigInt porque a documentacao
  // avisa que ele pode passar de 2^53 — e ai um `number` ja teria perdido
  // precisao antes de chegar aqui. Nao ha o que fazer contra isso no JSON.parse
  // padrao; o que da para garantir e nao perder mais nada daqui para o banco.
  const idBruto = chatObj.id;
  if (typeof idBruto !== 'number' || !Number.isFinite(idBruto)) return null;
  const chatId = BigInt(Math.trunc(idBruto));

  const textoBruto = msg.text;
  if (typeof textoBruto !== 'string') return null;
  const texto = textoBruto.slice(0, MAX_TEXTO).trim();

  const from = msg.from;
  const username =
    from && typeof from === 'object' && typeof (from as Record<string, unknown>).username === 'string'
      ? ((from as Record<string, unknown>).username as string).slice(0, 64)
      : null;

  return { chatId, texto, username };
}

/**
 * O payload de `/start <token>`, ou `null` se a mensagem nao for um `/start`.
 *
 * O alfabeto permitido pelo Telegram no parametro `start` e `A-Z a-z 0-9 _ -`,
 * ate 64 caracteres. Qualquer coisa fora disso nao veio de um link nosso, e
 * nem chega a consultar o banco.
 */
export function lerStart(texto: string): string | null {
  // `/start@nomedobot` acontece em grupo. Nao e o caso de uso, mas ignorar o
  // sufixo custa uma linha e evita um "link invalido" inexplicavel.
  const m = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(texto);
  if (!m) return null;
  const payload = m[1] ?? '';
  if (!payload) return '';
  return /^[A-Za-z0-9_-]{1,64}$/.test(payload) ? payload : null;
}
