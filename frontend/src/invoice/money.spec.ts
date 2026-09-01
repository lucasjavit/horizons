import { describe, it, expect } from 'vitest'
import {
  parseAmountToCents,
  parseQuantity,
  lineAmountCents,
  sumCents,
  somenteNumero,
  formatCents,
} from './money'

/**
 * Dinheiro e centavo inteiro, e este arquivo cobra isso.
 *
 * A regra vem do CLAUDE.md e do INV-11, nao da leitura do parser:
 *
 * - **nunca somar float**: `Math.round(1.005 * 100)` devolve 100 e perde um
 *   centavo, porque 1.005 * 100 e 100.49999999999999 em ponto flutuante;
 * - **a virgula do brasileiro e decimal**: o parser antigo apagava toda
 *   virgula assumindo milhar, e quem digitava `26,50` recebia uma fatura de
 *   $2.650,00 — cem vezes mais, sem nada na tela denunciando;
 * - **arredonda por linha e soma inteiros**, para o total impresso bater com a
 *   soma das linhas impressas, que e o que o cliente confere na calculadora.
 */

describe('parseAmountToCents — o bug do centavo perdido (INV-11)', () => {
  it('1.005 vira 101 centavos, e nao 100', () => {
    // O caminho obvio (Math.round(n * 100)) devolve 100 aqui. E O caso do
    // CLAUDE.md, e a razao de o parser ser baseado em string.
    expect(parseAmountToCents('1.005')).toBe(101)
  })

  it('confere contra o float, que erra: o parser NAO pode concordar com ele', () => {
    // Se um dia o parser voltar a multiplicar, este teste denuncia.
    expect(Math.round(1.005 * 100)).toBe(100)
    expect(parseAmountToCents('1.005')).toBe(101)
  })

  it.each([
    ['1.005', 101],
    ['2.005', 201],
    ['0.005', 1],
    ['1.015', 102],
    ['8.615', 862],
  ])('a terceira casa %s arredonda para cima -> %i centavos', (texto, esperado) => {
    expect(parseAmountToCents(texto)).toBe(esperado)
  })

  it.each([
    ['1.004', 100],
    ['1.0049', 100],
    ['0.004', 0],
  ])('a terceira casa abaixo de 5 (%s) desce -> %i centavos', (texto, esperado) => {
    expect(parseAmountToCents(texto)).toBe(esperado)
  })
})

describe('parseAmountToCents — a virgula do brasileiro e decimal (INV-11)', () => {
  it('26,50 em BRL e 2650 centavos, e nao 265000', () => {
    // O bug medido: apagar a virgula fazia 26,50 virar 2650 reais.
    expect(parseAmountToCents('26,50', 'BRL')).toBe(2650)
  })

  it.each(['BRL', 'EUR', 'CHF'])(
    'em %s a virgula com duas casas e decimal',
    (moeda) => {
      expect(parseAmountToCents('26,50', moeda)).toBe(2650)
      expect(parseAmountToCents('1,99', moeda)).toBe(199)
    },
  )

  it('em USD a virgula com duas casas tambem e decimal', () => {
    // Com duas casas nao ha ambiguidade em nenhuma notacao.
    expect(parseAmountToCents('26,50', 'USD')).toBe(2650)
  })

  it('o caso ambiguo 1,005: a MOEDA desempata', () => {
    // Tres digitos depois do separador e o unico caso ambiguo de verdade:
    // mil e cinco no Brasil, um e meio centavo nos EUA.
    expect(parseAmountToCents('1,005', 'BRL')).toBe(101)
    expect(parseAmountToCents('1,005', 'USD')).toBe(100500)
  })

  it('o espelho: 1.005 com ponto, na moeda de virgula decimal, e mil e cinco', () => {
    expect(parseAmountToCents('1.005', 'BRL')).toBe(100500)
    expect(parseAmountToCents('1.005', 'USD')).toBe(101)
  })

  it('com os DOIS separadores, o ultimo manda — e ele que separa centavos', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456) // europeu
    expect(parseAmountToCents('1,234.56')).toBe(123456) // americano
    expect(parseAmountToCents('1.234.567,89')).toBe(123456789)
    expect(parseAmountToCents('1,234,567.89')).toBe(123456789)
  })
})

describe('parseAmountToCents — o basico', () => {
  it.each([
    ['0', 0],
    ['1', 100],
    ['10', 1000],
    ['0.5', 50],
    ['0.05', 5],
    ['1.5', 150],
    ['1.50', 150],
    ['99.99', 9999],
    ['1000', 100000],
  ])('%s -> %i centavos', (texto, esperado) => {
    expect(parseAmountToCents(texto)).toBe(esperado)
  })

  it('aceita o simbolo da moeda colado, que a pessoa cola do e-mail', () => {
    expect(parseAmountToCents('$26.50')).toBe(2650)
    expect(parseAmountToCents('R$ 26,50', 'BRL')).toBe(2650)
    expect(parseAmountToCents('€26,50', 'EUR')).toBe(2650)
  })

  it('aceita espaco em volta', () => {
    expect(parseAmountToCents('  26.50  ')).toBe(2650)
  })

  it('preserva o negativo: recusar e trabalho da validacao, nao do parse', () => {
    expect(parseAmountToCents('-26.50')).toBe(-2650)
  })

  it.each(['', '   ', '-', 'abc', '$'])('devolve null para %p', (texto) => {
    expect(parseAmountToCents(texto)).toBeNull()
  })

  it('devolve null em vez de estourar o inteiro seguro', () => {
    // Melhor recusar que devolver um numero que nao soma direito.
    expect(parseAmountToCents('999999999999999999999')).toBeNull()
  })

  it('mais de duas casas nao vira centavo a mais: 1.9999 e 200', () => {
    expect(parseAmountToCents('1.9999')).toBe(200)
  })
})

describe('somenteNumero — o filtro da digitacao', () => {
  it('tira letra, que nem chega a aparecer no campo', () => {
    expect(somenteNumero('12a3')).toBe('123')
    expect(somenteNumero('abc')).toBe('')
  })

  it('aceita UM separador decimal, e ignora o segundo', () => {
    expect(somenteNumero('1.5')).toBe('1.5')
    expect(somenteNumero('1.5.5')).toBe('1.55')
    expect(somenteNumero('1,5')).toBe('1,5')
    expect(somenteNumero('1.5,5')).toBe('1.55')
  })

  it('deixa passar o estado intermediario da digitacao', () => {
    // Um input controlado por numero nao representa "" nem "3." nem "0.".
    expect(somenteNumero('3.')).toBe('3.')
    expect(somenteNumero('0,')).toBe('0,')
    expect(somenteNumero('')).toBe('')
  })

  it('aceita o sinal so na primeira posicao', () => {
    expect(somenteNumero('-5')).toBe('-5')
    expect(somenteNumero('5-')).toBe('5')
    expect(somenteNumero('-5-')).toBe('-5')
  })

  it('tira o simbolo de moeda', () => {
    expect(somenteNumero('$26.50')).toBe('26.50')
  })
})

describe('parseQuantity', () => {
  it('le quantidade fracionaria: meia hora e caso de uso real', () => {
    expect(parseQuantity('2.5')).toBe(2.5)
    expect(parseQuantity('0.5')).toBe(0.5)
  })

  it('usa a MESMA regra de separador do valor', () => {
    // Antes do INV-11 os dois campos da mesma linha interpretavam virgula de
    // formas opostas, e ninguem tinha notado.
    expect(parseQuantity('2,5', 'BRL')).toBe(2.5)
    expect(parseQuantity('2,5', 'USD')).toBe(2.5)
    expect(parseQuantity('1.234,5')).toBe(1234.5)
  })

  it('a quantidade e o valor concordam no caso ambiguo', () => {
    // Mesmo texto, mesma moeda: as duas leituras tem de contar a mesma
    // historia, senao a linha se contradiz.
    expect(parseQuantity('1,005', 'BRL')).toBe(1.005)
    expect(parseAmountToCents('1,005', 'BRL')).toBe(101)
    expect(parseQuantity('1,005', 'USD')).toBe(1005)
    expect(parseAmountToCents('1,005', 'USD')).toBe(100500)
  })

  it.each(['', '   ', '-', 'abc'])('devolve null para %p', (texto) => {
    expect(parseQuantity(texto)).toBeNull()
  })
})

describe('lineAmountCents — arredonda por linha', () => {
  it('multiplica quantidade por centavo e arredonda', () => {
    expect(lineAmountCents(2, 2650)).toBe(5300)
    expect(lineAmountCents(2.5, 10000)).toBe(25000)
  })

  it('arredonda a fracao de centavo que a quantidade cria', () => {
    // 3 x 33,33 = 99,99; a fracao nao pode virar centavo fantasma.
    expect(lineAmountCents(0.5, 333)).toBe(167) // 166,5 -> 167
    expect(lineAmountCents(1 / 3, 100)).toBe(33)
  })

  it('devolve 0 para entrada que nao e numero, em vez de NaN', () => {
    // NaN vazaria para o PDF como "NaN" impresso na fatura.
    expect(lineAmountCents(NaN, 100)).toBe(0)
    expect(lineAmountCents(1, NaN)).toBe(0)
    expect(lineAmountCents(Infinity, 100)).toBe(0)
  })

  it('quantidade zero da linha zero', () => {
    expect(lineAmountCents(0, 2650)).toBe(0)
  })
})

describe('sumCents e o total que bate com as linhas impressas', () => {
  it('soma de inteiros e exata', () => {
    expect(sumCents([1, 2, 3])).toBe(6)
    expect(sumCents([])).toBe(0)
  })

  it('o total bate com a soma das linhas impressas', () => {
    // A regra do CLAUDE.md: arredonda por linha e soma inteiros. O cliente
    // confere na calculadora, e a conta tem de fechar.
    const linhas = [
      lineAmountCents(3, 3333), // 99,99
      lineAmountCents(0.5, 333), // 1,67
      lineAmountCents(2, 2650), // 53,00
    ]
    expect(linhas).toEqual([9999, 167, 5300])
    expect(sumCents(linhas)).toBe(15466)
  })

  it('somar em float perderia centavo: a soma inteira nao perde', () => {
    // 0,1 + 0,2 !== 0,3 em float. Em centavo inteiro, 10 + 20 === 30, sempre.
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumCents([10, 20])).toBe(30)
  })

  it('cem linhas de um centavo somam exatamente um real', () => {
    expect(sumCents(Array(100).fill(1))).toBe(100)
  })
})

describe('formatCents', () => {
  it('formata em en-US, qualquer que seja o navegador de quem abre', () => {
    // Um visitante alemao nao pode receber "1.234,50 €" num documento que o
    // remetente revisou como "€1,234.50".
    expect(formatCents(123450, 'USD')).toBe('$1,234.50')
    expect(formatCents(123450, 'EUR')).toBe('€1,234.50')
  })

  it('sempre duas casas decimais', () => {
    expect(formatCents(100, 'USD')).toBe('$1.00')
    expect(formatCents(0, 'USD')).toBe('$0.00')
  })

  it('nao deixa espaco inquebravel vazar para o PDF', () => {
    // O CHF sai com U+00A0, que vaza para o PDF e para a area de transferencia.
    expect(formatCents(123450, 'CHF')).not.toContain(' ')
  })

  it('o que foi lido volta formatado igual ao que se digitou', () => {
    const cents = parseAmountToCents('1.234,56')
    expect(cents).not.toBeNull()
    expect(formatCents(cents as number, 'USD')).toBe('$1,234.56')
  })
})
