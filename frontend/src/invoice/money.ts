import type { CurrencyCode } from './types'

/**
 * Dinheiro em centavos inteiros.
 *
 * Regra da casa: nunca somar float. Um float existe so na borda de entrada
 * (o texto que a pessoa digitou) e na de saida (a string formatada). Entre
 * os dois, tudo e inteiro.
 */

/**
 * Moedas cuja notacao usa virgula como decimal (1.234,56).
 *
 * Serve para desempatar o caso ambiguo: `1.005` e mil e cinco na notacao
 * brasileira e um e meio centavo na americana. A moeda escolhida diz qual
 * das duas a pessoa esta usando.
 */
const DECIMAL_VIRGULA: ReadonlySet<string> = new Set(['BRL', 'EUR', 'CHF'])

/**
 * Descobre qual separador e o decimal e normaliza para ponto.
 *
 * Isto existe por causa do INV-11: o parser antigo apagava toda virgula
 * assumindo separador de milhar, entao quem digitava `26,50` — como escreve
 * qualquer brasileiro — recebia uma fatura de $2.650,00. Cem vezes mais, sem
 * nada na tela denunciando.
 *
 * A regra: quando ha os dois separadores, **o ultimo manda**, porque e ele
 * que separa os centavos em qualquer notacao. Com um so, decide pela
 * quantidade de digitos depois dele.
 */
function normalizarSeparadores(s: string, moeda?: string): string {
  const ultimaVirgula = s.lastIndexOf(',')
  const ultimoPonto = s.lastIndexOf('.')

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // `1.234,56` (europeu) ou `1,234.56` (americano): o que vem por ultimo
    // e o decimal, o outro e milhar e sai.
    return ultimaVirgula > ultimoPonto
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  }

  // Com um separador so, tres digitos depois dele sao ambiguos: `1.005` e
  // mil e cinco no Brasil e um e meio centavo nos EUA. A moeda desempata.
  const virgulaEhDecimal = moeda ? DECIMAL_VIRGULA.has(moeda) : false

  if (ultimaVirgula >= 0) {
    const depois = s.length - ultimaVirgula - 1
    if (depois !== 3) return s.replace(',', '.')
    // Numa moeda de virgula decimal, `1,005` e um e meio centavo; nas
    // outras, a virgula so pode ser milhar.
    return virgulaEhDecimal ? s.replace(',', '.') : s.replace(',', '')
  }

  if (ultimoPonto >= 0) {
    const depois = s.length - ultimoPonto - 1
    if (depois !== 3) return s
    // Espelho do caso acima: numa moeda de virgula decimal o ponto e milhar,
    // entao `1.005` vira mil e cinco.
    return virgulaEhDecimal ? s.replace('.', '') : s
  }

  return s
}

/**
 * Le um valor digitado e devolve centavos inteiros, ou null se invalido.
 *
 * Baseado em string de proposito. O caminho obvio — `Math.round(n * 100)` —
 * esta errado: 1.005 * 100 vira 100.49999999999999 em float, o arredondamento
 * puxa para 100 e a fatura perde um centavo.
 */
export function parseAmountToCents(raw: string, moeda?: string): number | null {
  // Tira simbolo de moeda e espaco; sobram digitos, separadores e sinal.
  const so = raw.trim().replace(/[^0-9.,-]/g, '')
  const limpo = normalizarSeparadores(so, moeda)
  if (limpo === '' || limpo === '-') return null

  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(limpo)
  if (!m) return null

  const sinal = m[1] === '-' ? -1 : 1
  const inteiro = m[2] || '0'
  const frac = (m[3] ?? '').padEnd(2, '0')

  let centavos = Number(inteiro) * 100 + Number(frac.slice(0, 2))

  // Terceira casa decimal arredonda para cima, olhando o caractere em vez
  // de multiplicar — e isso que salva o 1.005.
  if (frac.charCodeAt(2) >= 53 /* '5' */) centavos += 1

  return Number.isSafeInteger(centavos) ? sinal * centavos : null
}

/**
 * Le uma quantidade, que pode ser fracionaria (2,5 horas).
 *
 * Usa a MESMA regra de separador do valor: antes do INV-11 os dois campos da
 * mesma linha interpretavam virgula de formas opostas, e ninguem tinha notado
 * porque quantidade raramente leva decimal.
 */
export function parseQuantity(raw: string, moeda?: string): number | null {
  const so = raw.trim().replace(/[^0-9.,-]/g, '')
  const limpo = normalizarSeparadores(so, moeda)
  if (limpo === '' || limpo === '-') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * Valor de uma linha, ja arredondado para centavo.
 *
 * Arredondar aqui, e nao no total, e o que faz a soma das linhas impressas
 * bater com o total impresso — que e o que o cliente confere na calculadora.
 */
export function lineAmountCents(quantity: number, rateCents: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(rateCents)) return 0
  const centavos = Math.round(quantity * rateCents)
  return Number.isSafeInteger(centavos) ? centavos : 0
}

/** Soma de inteiros: exata por construcao. */
export function sumCents(valores: readonly number[]): number {
  return valores.reduce((acc, v) => acc + v, 0)
}

/**
 * Formata centavos na moeda escolhida.
 *
 * Locale fixo em en-US de proposito: a fatura inteira e em ingles, entao o
 * formato nao pode mudar conforme o navegador de quem abre. Um visitante
 * alemao nao pode receber "1.234,50 €" num documento que o remetente
 * revisou como "€1,234.50".
 */
export function formatCents(cents: number, currency: CurrencyCode): string {
  return (
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(cents / 100)
      // O CHF sai com espaco inquebravel (U+00A0); normaliza para espaco
      // comum, senao ele vaza para o PDF e para a area de transferencia.
      .replace(/ /g, ' ')
  )
}
