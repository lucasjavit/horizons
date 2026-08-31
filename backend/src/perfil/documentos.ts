/**
 * Paises e a validacao do documento de cada um.
 *
 * ## O escopo, e por que ele para onde para
 *
 * Validar documento de 190 paises e escopo infinito, e cada digito verificador
 * errado recusa gente de verdade. O produto mira a America Latina (JOB-19:
 * Brasil, Mexico, Colombia e Argentina sao os maiores mercados), entao a regra
 * e:
 *
 * - **Validacao real** para os seis com regra publica, estavel e testavel:
 *   BR, MX, AR, CO, CL, PE. Cinco deles tem digito verificador; a Colombia
 *   nao tem no formato civil (a cedula e so numerica), entao ali a regra e
 *   comprimento.
 * - **Caminho generico** para todo o resto do mundo: 4 a 32 caracteres
 *   alfanumericos. Ninguem fica sem caminho — quem esta na India ou nas
 *   Filipinas preenche e salva.
 *
 * O caminho generico e deliberadamente frouxo. Recusar um documento valido de
 * um pais que nao modelamos e pior que aceitar um invalido: o documento nao
 * paga nada hoje (PLT-10 — perfil vazio e perfil valido), e o dia em que ele
 * pagar, a nota fiscal daquele pais tera regra propria de qualquer forma.
 */

export interface Pais {
  /** ISO 3166-1 alfa-2. E o que vai no banco. */
  codigo: string;
  nome: string;
  /** DDI, para o telefone. Sem o `+`. */
  ddi: string;
  /** Como o documento se chama ali — vira rotulo na tela. */
  documento: string;
  /**
   * Exemplo de FORMATO, para o `placeholder`.
   *
   * ⚠️ Deliberadamente nao e um documento valido: um placeholder que passa na
   * validacao parece um valor ja preenchido. Na verificacao de 31/08 o
   * exemplo do Brasil era um CPF valido de verdade e foi confundido com um
   * vazamento do documento salvo.
   */
  exemplo: string;
}

/**
 * Os paises oferecidos na tela.
 *
 * A lista e curada, e nao os 249 do ISO: uma lista completa esconde os quatro
 * que respondem por quase todo o publico no meio de duzentos que nunca serao
 * escolhidos. Os seis com validacao real vem primeiro, depois os demais em
 * ordem alfabetica, e `OTHER` fecha a lista para quem nao esta nela.
 */
export const PAISES: Pais[] = [
  { codigo: 'BR', nome: 'Brazil', ddi: '55', documento: 'CPF', exemplo: '000.000.000-00' },
  { codigo: 'MX', nome: 'Mexico', ddi: '52', documento: 'RFC', exemplo: 'AAAA000000AAA' },
  { codigo: 'AR', nome: 'Argentina', ddi: '54', documento: 'CUIT/CUIL', exemplo: '20-00000000-0' },
  { codigo: 'CO', nome: 'Colombia', ddi: '57', documento: 'Cedula de ciudadania', exemplo: '1234567890' },
  { codigo: 'CL', nome: 'Chile', ddi: '56', documento: 'RUT', exemplo: '00.000.000-0' },
  { codigo: 'PE', nome: 'Peru', ddi: '51', documento: 'DNI', exemplo: '12345678' },
  { codigo: 'BO', nome: 'Bolivia', ddi: '591', documento: 'National ID', exemplo: '1234567' },
  { codigo: 'CR', nome: 'Costa Rica', ddi: '506', documento: 'Cedula', exemplo: '123456789' },
  { codigo: 'DO', nome: 'Dominican Republic', ddi: '1', documento: 'Cedula', exemplo: '00112345678' },
  { codigo: 'EC', nome: 'Ecuador', ddi: '593', documento: 'Cedula', exemplo: '1234567890' },
  { codigo: 'ES', nome: 'Spain', ddi: '34', documento: 'DNI/NIE', exemplo: '12345678Z' },
  { codigo: 'GT', nome: 'Guatemala', ddi: '502', documento: 'DPI', exemplo: '1234567890101' },
  { codigo: 'IN', nome: 'India', ddi: '91', documento: 'PAN', exemplo: 'ABCDE1234F' },
  { codigo: 'NG', nome: 'Nigeria', ddi: '234', documento: 'NIN', exemplo: '12345678901' },
  { codigo: 'PA', nome: 'Panama', ddi: '507', documento: 'Cedula', exemplo: '8-123-4567' },
  { codigo: 'PH', nome: 'Philippines', ddi: '63', documento: 'TIN', exemplo: '123-456-789' },
  { codigo: 'PT', nome: 'Portugal', ddi: '351', documento: 'NIF', exemplo: '123456789' },
  { codigo: 'PY', nome: 'Paraguay', ddi: '595', documento: 'Cedula', exemplo: '1234567' },
  { codigo: 'US', nome: 'United States', ddi: '1', documento: 'SSN/ITIN', exemplo: '123-45-6789' },
  { codigo: 'UY', nome: 'Uruguay', ddi: '598', documento: 'Cedula', exemplo: '1.234.567-8' },
  { codigo: 'VE', nome: 'Venezuela', ddi: '58', documento: 'Cedula', exemplo: 'V-12345678' },
  { codigo: 'OTHER', nome: 'Other', ddi: '', documento: 'National ID', exemplo: 'ID number' },
];

const POR_CODIGO = new Map(PAISES.map((p) => [p.codigo, p]));

export function paisPorCodigo(codigo: string): Pais | undefined {
  return POR_CODIGO.get(codigo);
}

/**
 * So os digitos — mas **apenas** quando o resto e mascara.
 *
 * Um `replace(/\D/g, '')` cru APAGA as letras em vez de reprovar, e entao
 * `"CPF 123.456.789-09"` e `"AB12345678"` passavam como se fossem numeros
 * limpos (medido, 31/08). Aqui qualquer caractere que nao seja digito ou
 * separador de leitura invalida o valor inteiro, devolvendo `''` — que
 * nenhuma regra de comprimento aceita.
 */
function digitos(v: string): string {
  const limpo = v.replace(/[.\s-]/g, '');
  return /^\d+$/.test(limpo) ? limpo : '';
}

/**
 * CPF: 11 digitos e dois verificadores modulo 11.
 *
 * A rejeicao dos repetidos (`11111111111`) e obrigatoria: eles PASSAM no
 * calculo do digito verificador — e a armadilha classica de quem implementa
 * so a formula.
 */
function cpfValido(bruto: string): boolean {
  const d = digitos(bruto);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  for (const [ate, pos] of [[9, 9], [10, 10]] as const) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== Number(d[pos])) return false;
  }
  return true;
}

/**
 * CUIT/CUIL argentino: 11 digitos, verificador modulo 11 com pesos ciclicos.
 *
 * O prefixo diz o tipo (20/23/24/27 pessoa fisica, 30/33/34 juridica) e e
 * conferido: 11 digitos quaisquer com verificador certo nao sao um CUIT.
 */
function cuitValido(bruto: string): boolean {
  const d = digitos(bruto);
  if (d.length !== 11) return false;
  if (!['20', '23', '24', '27', '30', '33', '34'].includes(d.slice(0, 2))) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const soma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const resto = 11 - (soma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(d[10]);
}

/**
 * RUT chileno: corpo numerico + verificador modulo 11, que pode ser `K`.
 *
 * O `K` e a razao de o RUT nao caber num campo "so numeros" — vale 10.
 */
function rutValido(bruto: string): boolean {
  const limpo = bruto.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(limpo)) return false;
  const corpo = limpo.slice(0, -1);
  const dv = limpo.slice(-1);
  let soma = 0;
  let peso = 2;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += Number(corpo[i]) * peso;
    peso = peso === 7 ? 2 : peso + 1;
  }
  const resto = 11 - (soma % 11);
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return esperado === dv;
}

/**
 * RFC mexicano: 4 letras (3 se pessoa juridica) + AAMMDD + 3 da homoclave.
 *
 * A data e conferida de verdade — `880231` nao existe, e um RFC com data
 * impossivel e erro de digitacao, nao um contribuinte exotico.
 */
function rfcValido(bruto: string): boolean {
  const v = bruto.replace(/[\s-]/g, '').toUpperCase();
  const m = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/.exec(v);
  if (!m) return false;
  const [, , data] = m;
  const ano = Number(data.slice(0, 2));
  const mes = Number(data.slice(2, 4));
  const dia = Number(data.slice(4, 6));
  if (mes < 1 || mes > 12) return false;
  // O dia e conferido CONTRA O MES, e nao contra o teto 31: `880231` passava
  // no limite generico e 31 de fevereiro nao existe. O seculo e ambiguo no
  // RFC (dois digitos), entao para o bissexto assume-se 19xx/20xx pelo pior
  // caso — aceitar 29/02 e melhor que recusar quem nasceu nele.
  const bissexto = (2000 + ano) % 4 === 0;
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (dia < 1 || dia > diasNoMes[mes - 1]) return false;
  return true;
}

/**
 * Cedula colombiana: so numerica, 6 a 10 digitos. Nao ha verificador.
 *
 * A regex roda sobre o valor com os separadores tirados, e **nao** sobre
 * `digitos()`: aquele apaga as letras em vez de reprovar, entao `ABC123456`
 * virava `123456` e passava (medido, 31/08).
 */
function cedulaCoValida(bruto: string): boolean {
  return /^\d{6,10}$/.test(bruto.replace(/[.\s-]/g, ''));
}

/** DNI peruano: exatamente 8 digitos. O digito verificador e opcional e raro. */
function dniPeValido(bruto: string): boolean {
  return /^\d{8}$/.test(digitos(bruto));
}

/**
 * O caminho de todo mundo que nao esta modelado.
 *
 * Alfanumerico com separadores comuns, 4 a 32. Frouxo de proposito: ver o
 * cabecalho deste arquivo.
 */
function genericoValido(bruto: string): boolean {
  const limpo = bruto.trim();
  if (limpo.length < 4 || limpo.length > 32) return false;
  return /^[A-Za-z0-9][A-Za-z0-9.\-/ ]*[A-Za-z0-9]$/.test(limpo);
}

const REGRAS: Record<string, (v: string) => boolean> = {
  BR: cpfValido,
  AR: cuitValido,
  CL: rutValido,
  MX: rfcValido,
  CO: cedulaCoValida,
  PE: dniPeValido,
};

/** Quais paises tem regra propria — a tela usa isto para explicar o formato. */
export const PAISES_COM_REGRA = Object.keys(REGRAS);

/**
 * O documento serve para o pais escolhido?
 *
 * `null` quando serve. Quando nao serve, a mensagem ja e a que vai para a
 * tela — em ingles, porque e texto de interface.
 */
export function validarDocumento(pais: string, documento: string): string | null {
  const limpo = documento.trim();
  // Vazio e valido: perfil vazio e perfil valido (PLT-10).
  if (!limpo) return null;

  const meta = paisPorCodigo(pais);
  if (!meta) return 'Pick a country first';

  const regra = REGRAS[pais];
  if (regra) {
    return regra(limpo) ? null : `That is not a valid ${meta.documento} for ${meta.nome}`;
  }
  return genericoValido(limpo)
    ? null
    : 'Use 4 to 32 letters, digits, dots, dashes or slashes';
}

/**
 * Os ultimos digitos, para a pessoa reconhecer o que esta guardado sem que o
 * valor volte para a tela — o mesmo gesto do `hint` do ApiToken (PLT-01).
 *
 * Guarda no maximo 4 caracteres, e menos quando o documento e curto: mostrar
 * 4 de um documento de 7 caracteres entregaria mais da metade dele.
 */
export function dicaDoDocumento(documento: string): string {
  const limpo = documento.trim().replace(/[.\s-]/g, '');
  return limpo.slice(-Math.min(4, Math.max(1, Math.floor(limpo.length / 2))));
}
