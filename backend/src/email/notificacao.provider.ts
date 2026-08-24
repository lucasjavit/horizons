/**
 * Por onde uma notificacao de vagas sai — e-mail, Telegram, o que vier depois.
 *
 * **A generalizacao pedida pelo JOB-32, e o que ela NAO e.** A tentacao seria
 * renomear a `Mensagem` do e-mail e chamar de abstracao: ela tem `para` (um
 * endereco de e-mail), `html` e `texto`, e o Telegram nao aceita nenhum dos
 * tres — o destino e um `chat_id` numerico e o corpo nao e HTML de e-mail.
 * Uma interface que servisse aos dois por uniao de campos opcionais so
 * empurraria o `if` para dentro de cada provedor.
 *
 * O que de fato se compartilha, e o que o card manda compartilhar, e a
 * **selecao de vagas** ("novas desde o ultimo envio, respeitando a cadencia")
 * e os dados dela (`DadosDoEmail`). A renderizacao e por canal: `montarCorpo`
 * para o e-mail, `montarTexto` para o Telegram. Por isso o que esta abstraido
 * aqui e so o transporte, com o destino tipado pelo proprio canal.
 *
 * `EmailProvider` continua existindo com a assinatura dele: e o provedor de
 * um canal, e nao a abstracao. Quem varre e decide manda nos dois.
 */

/** O resultado de tentar entregar, igual para todo canal. */
export interface ResultadoEnvio {
  /** Saiu de fato? `false` cobre tanto "nao configurado" quanto "recusado". */
  enviado: boolean;
  /** Qual provedor atendeu — vai para o log e para a tela do admin. */
  provedor: string;
  /** Por que nao saiu, quando `enviado` e falso. */
  motivo?: string;
  /**
   * O destino recusou de vez — bloqueio, conta apagada, chat inexistente.
   *
   * **Diferente de uma falha temporaria**, e por isso e um campo proprio: rede
   * caida pede nova tentativa na semana seguinte; bot bloqueado e um
   * descadastro de fato, e insistir toda semana e o sistema falando com quem
   * mandou parar. Quem recebe isto desliga o canal daquela pessoa.
   */
  destinoInvalido?: boolean;
}

/**
 * Um canal de notificacao.
 *
 * **Sem `enviar` aqui, e isso e deliberado.** Um `enviar(destino, corpo)`
 * generico obrigaria cada canal a se contorcer para caber: o e-mail carrega o
 * destino dentro da propria `Mensagem` (`para`), e passa-lo tambem por fora
 * seria repetir o mesmo dado em dois lugares, que e a forma classica de eles
 * divergirem. A assinatura de envio pertence ao canal.
 *
 * O que esta contratado aqui e o que quem varre precisa saber de QUALQUER
 * canal, sem conhecer nenhum: como se chama, se entrega de verdade, e o que
 * uma tentativa respondeu. E o suficiente para a regra do carimbo valer igual
 * nos dois, que e a regra que o card protege.
 */
export abstract class NotificacaoProvider {
  /** Nome curto, para log e para a tela do admin. */
  abstract readonly nome: string;
  /**
   * Este provedor entrega de verdade?
   *
   * **A pergunta que impede o carimbo de mentir.** Provedor que so registra no
   * log responde `false`, e quem chama nao avanca `ultimoEnvioEm` — senao, no
   * dia em que a credencial real entrar, a pessoa receberia um comeco do zero
   * como se as semanas anteriores tivessem sido entregues.
   */
  abstract readonly entrega: boolean;
}
