/**
 * O endereco de cobranca, e as decisoes que ele carrega.
 *
 * ## Campos separados, e nao um bloco de texto
 *
 * Um `<textarea>` livre nunca trava quem mora onde o formato e outro, mas o
 * endereco existe para **imprimir numa nota fiscal**: cidade, estado e codigo
 * postal viram linhas separadas no documento, e a nota de varios paises exige
 * a cidade sozinha para calcular imposto. Reconstituir isso de um bloco de
 * texto e adivinhacao.
 *
 * A saida e o meio-termo: **campos separados, com validacao frouxa**. Cada
 * peca tem seu lugar (a nota sabe onde ler a cidade), e nenhuma peca impoe
 * formato brasileiro (so comprimento e um alfabeto largo).
 *
 * ## O que NAO se valida, e por que
 *
 * **O codigo postal nao e conferido contra o pais.** O CEP brasileiro tem
 * formato conhecido, mas o do Peru tem 5 digitos, o da Argentina virou
 * alfanumerico em 1998 (`C1425DKE`), a Colombia mal usa o dela e varios paises
 * da lista nao tem codigo postal nenhum. E a mesma logica do documento
 * (PLT-10): **recusar um codigo postal valido de um pais nao modelado e pior
 * que aceitar um estranho** — a diferenca e que aqui nem os seis com regra de
 * documento ganham regra de CEP, porque a nota fiscal que um dia usar isso
 * tera a validacao do proprio emissor.
 *
 * O unico limite e comprimento e alfabeto: 2 a 16, letras, digitos, espaco e
 * traco. Isso barra colar um paragrafo no campo errado, e nada mais.
 *
 * ## O alfabeto e latino ESTENDIDO
 *
 * `Bogotá`, `São Paulo`, `Ñuñoa` e `Córdoba` sao nomes de cidade reais no
 * publico-alvo. Um `[A-Za-z]` recusaria os quatro.
 */

/**
 * Alfabeto de texto de endereco: letras (com acento), digitos, e a pontuacao
 * que aparece em logradouro de verdade — ponto, virgula, traco, barra,
 * apostrofo (`O'Higgins`, avenida chilena), `#` (usado na Colombia:
 * `Calle 26 #13-19`) e `º`/`°` (`1º andar`).
 *
 * Nao ha regra de "tem que ter numero" nem de ordem: em varios paises o
 * numero vem antes da rua, e em alguns endereco rural nao tem numero.
 */
const TEXTO = /^[\p{L}\p{N} .,'\-/#º°ºª]+$/u;

/** Codigo postal: so comprimento e alfabeto. Ver o cabecalho deste arquivo. */
const CODIGO_POSTAL = /^[A-Za-z0-9][A-Za-z0-9 -]*[A-Za-z0-9]$/;

/**
 * Um campo de endereco e aceitavel?
 *
 * `null` quando esta. Vazio sempre esta: **nenhum campo do endereco e
 * obrigatorio neste card** — perfil vazio continua sendo perfil valido
 * (PLT-10), e endereco pela metade tambem e valido, porque a obrigatoriedade
 * mora no card da compra.
 *
 * A mensagem devolvida ja e a da tela, em ingles.
 */
export function validarTextoDeEndereco(
  rotulo: string,
  valor: string,
  max: number,
): string | null {
  const limpo = valor.trim();
  if (!limpo) return null;
  if (limpo.length > max) return `${rotulo} is too long (max ${max})`;
  return TEXTO.test(limpo)
    ? null
    : `${rotulo} has characters we cannot use — letters, digits, spaces and . , - / # only`;
}

/** O codigo postal cabe? Vazio cabe. Ver o cabecalho sobre o que NAO se checa. */
export function validarCodigoPostal(valor: string): string | null {
  const limpo = valor.trim();
  if (!limpo) return null;
  if (limpo.length < 2 || limpo.length > 16) {
    return 'Postal code must be 2 to 16 characters';
  }
  return CODIGO_POSTAL.test(limpo)
    ? null
    : 'Postal code can only use letters, digits, spaces and dashes';
}
