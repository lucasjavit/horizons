import type { CurrencyCode } from './types'

/**
 * Dinheiro em centavos inteiros.
 *
 * Regra da casa: nunca somar float. Um float existe so na borda de entrada
 * (o texto que a pessoa digitou) e na de saida (a string formatada). Entre
 * os dois, tudo e inteiro.
 */

/**
 * Le um valor digitado e devolve centavos inteiros, ou null se invalido.
 *
 * Baseado em string de proposito. O caminho obvio — `Math.round(n * 100)` —
 * esta errado: 1.005 * 100 vira 100.49999999999999 em float, o arredondamento
 * puxa para 100 e a fatura perde um centavo.
 */
export function parseAmountToCents(raw: string): number | null {
  // Remove simbolo de moeda e separador de milhar; o que sobra e digito,
  // ponto e sinal.
  const limpo = raw.trim().replace(/[^0-9.,-]/g, '').replace(/,/g, '')
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

/** Le uma quantidade, que pode ser fracionaria (2,5 horas). */
export function parseQuantity(raw: string): number | null {
  const limpo = raw.trim().replace(/,/g, '.')
  if (limpo === '') return null
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
