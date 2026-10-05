/**
 * Camada 1 — `invoice/pdf.ts`, o desenho do documento (INV-18).
 *
 * O PDF e o unico desfecho da tela de Invoice, e ninguem o le antes de mandar
 * para o cliente. O INV-18 foi um endereco de banco comprido saindo pela
 * margem esquerda da folha, em producao: o texto era escrito numa posicao
 * fixa, sem medir.
 *
 * Por isso este teste **gera o PDF de verdade** e confere POSICAO, e nao so
 * "nao lancou": cada `doc.text` e anotado com a largura medida na fonte que
 * estava ativa na hora, e as regras sao geometricas — nada fora das margens,
 * nada por cima de outro texto, a linha seguinte abaixo da anterior.
 *
 * O jsPDF entra pelo pacote npm, posto em `window.jspdf`: em producao ele vem
 * por <script> de `public/vendor/` (ver `carregarJsPdf`), e os dois sao a
 * mesma versao (4.2.1 / autotable 5.0.8). Subiu um, suba o outro.
 */
import { jsPDF } from 'jspdf'
import { applyPlugin } from 'jspdf-autotable'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { generateInvoicePdf } from './pdf'
import type { InvoiceDraft } from './types'

const MARGEM = 15
const LARGURA = 210
const ALTURA = 297
const DIREITA = LARGURA - MARGEM
/** Folga de arredondamento de ponto flutuante, em mm. */
const EPS = 0.01

interface Texto {
  pagina: number
  texto: string
  x: number
  y: number
  alinhado: string
  /** Onde o texto comeca e termina de fato, ja descontado o alinhamento. */
  esquerda: number
  direita: number
  negrito: boolean
  tamanho: number
}
interface Faixa {
  pagina: number
  x: number
  y: number
  w: number
  h: number
}
interface Fio {
  pagina: number
  y: number
}

let textos: Texto[] = []
let faixas: Faixa[] = []
let fios: Fio[] = []

/**
 * Um jsPDF que anota o que desenha.
 *
 * Funcao construtora, e nao subclasse: os metodos do jsPDF sao criados por
 * instancia dentro do construtor, entao espionar o prototipo nao pega nada.
 * `new Espiao()` devolve o documento de verdade, com tres metodos embrulhados.
 */
function Espiao(opcoes: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new jsPDF(opcoes as never) as any
  const pagina = (): number => doc.getCurrentPageInfo().pageNumber

  const text = doc.text.bind(doc)
  doc.text = (t: string | string[], x: number, y: number, op?: { align?: string }, ...resto: unknown[]) => {
    const alinhado = op?.align ?? 'left'
    // O autotable manda a celula como lista de linhas; cada uma e medida.
    for (const linha of Array.isArray(t) ? t : [t]) {
      // Medido AGORA, com a fonte e o tamanho que vao para o papel.
      const w = doc.getTextWidth(linha)
      const esquerda = alinhado === 'right' ? x - w : alinhado === 'center' ? x - w / 2 : x
      textos.push({
        pagina: pagina(),
        texto: linha,
        x,
        y,
        alinhado,
        esquerda,
        direita: esquerda + w,
        negrito: doc.getFont().fontStyle === 'bold',
        tamanho: doc.getFontSize(),
      })
    }
    return text(t, x, y, op, ...resto)
  }

  const rect = doc.rect.bind(doc)
  doc.rect = (x: number, y: number, w: number, h: number, ...resto: unknown[]) => {
    faixas.push({ pagina: pagina(), x, y, w, h })
    return rect(x, y, w, h, ...resto)
  }

  const line = doc.line.bind(doc)
  doc.line = (x1: number, y1: number, x2: number, y2: number, ...resto: unknown[]) => {
    fios.push({ pagina: pagina(), y: y1 })
    return line(x1, y1, x2, y2, ...resto)
  }
  return doc
}

async function gerar(draft: InvoiceDraft): Promise<void> {
  const blob = await generateInvoicePdf(draft)
  // Um PDF vazio ou truncado tambem "nao lanca".
  expect(blob.size).toBeGreaterThan(1000)
}

/**
 * Faixa que vai de uma margem a outra — a zebra do pagamento. A folha A4 do
 * jsPDF tem 210,0016mm, entao a largura nao e 180 exato.
 */
function deMargemAMargem(f: Faixa): boolean {
  return Math.abs(f.x - MARGEM) < EPS && Math.abs(f.w - (LARGURA - MARGEM * 2)) < EPS
}

/** O unico texto com este conteudo. Falha se houver zero ou mais de um. */
function unico(texto: string): Texto {
  const achados = textos.filter((t) => t.texto === texto)
  expect(achados, `"${texto}" deveria aparecer uma vez`).toHaveLength(1)
  return achados[0]
}

/**
 * As linhas de PAYMENT DETAILS da pagina 1: o que esta entre o titulo do
 * bloco e o cabecalho da tabela de itens.
 */
function linhasDoPagamento(): { rotulos: Texto[]; valores: Texto[] } {
  const topo = unico('PAYMENT DETAILS').y
  const fundo = unico('DESCRIPTION').y
  const dentro = textos.filter((t) => t.pagina === 1 && t.y > topo + EPS && t.y < fundo - EPS)
  return {
    rotulos: dentro.filter((t) => !t.negrito),
    valores: dentro.filter((t) => t.negrito),
  }
}

/** Nenhum texto comeca antes da margem esquerda nem termina depois da direita. */
function esperarTudoDentroDasMargens(): void {
  const fora = textos
    .filter((t) => t.esquerda < MARGEM - EPS || t.direita > DIREITA + EPS)
    .map((t) => `p${t.pagina} "${t.texto}" de ${t.esquerda.toFixed(1)} a ${t.direita.toFixed(1)}mm`)
  expect(fora, 'texto fora das margens de 15mm').toEqual([])
}

/** Dois textos na mesma linha de base nunca ocupam o mesmo trecho horizontal. */
function esperarNadaPorCima(): void {
  const colisoes: string[] = []
  textos.forEach((a, i) => {
    for (const b of textos.slice(i + 1)) {
      if (a.pagina !== b.pagina || Math.abs(a.y - b.y) > EPS) continue
      if (a.esquerda < b.direita - EPS && b.esquerda < a.direita - EPS) {
        colisoes.push(`p${a.pagina} y=${a.y.toFixed(1)}: "${a.texto}" x "${b.texto}"`)
      }
    }
  })
  expect(colisoes, 'texto escrito por cima de outro').toEqual([])
}

const ENDERECO =
  'Rua Professor Doutor Antonio Carlos de Albuquerque Figueiredo, 1234, Apartamento 1502 Bloco B, Jardim das Acacias Imperiais, Sao Jose dos Campos, Sao Paulo, 12345-678, Brazil'
const ROTULO_LONGO =
  'Beneficiary name with a very very long label that goes on and on forever'
/** 182 caracteres sem um espaco: nao ha onde quebrar por palavra. */
const SEM_ESPACO = `https://pay.example.com/invoice/${'a1b2c3d4e5'.repeat(15)}`

function curto(): InvoiceDraft {
  return {
    version: 1,
    invoiceNumber: 'INV-001',
    issueDate: '2026-10-05',
    dueDate: '2026-11-05',
    currency: 'USD',
    from: {
      name: 'Lucas Vieira',
      address: 'Rua A, 10\nSao Paulo, Brazil',
      email: 'lucas@example.com',
      taxId: '123',
    },
    billTo: { name: 'Acme Inc', address: '1 Main St\nNew York, NY', email: 'ap@acme.com' },
    items: [{ id: '1', description: 'Logo design', quantity: '10', rate: '50' }],
    paymentDetails: '',
    paymentFields: [
      { id: 'a', label: 'Payment Method', value: 'Wire' },
      { id: 'b', label: 'IBAN', value: 'BR1800360305000010009795493C1' },
      // Sem valor: nao entra no documento, e nao conta na alternancia da zebra.
      { id: 'c', label: 'Bank', value: '' },
      { id: 'd', label: 'SWIFT Code', value: 'ABCDBRSP' },
    ],
  }
}

/** O caso relatado em producao, mais os vizinhos que tinham o mesmo defeito. */
function longo(): InvoiceDraft {
  return {
    ...curto(),
    invoiceNumber: 'INV-2026-000000000123456789-ACME-CONSULTING',
    from: {
      name: 'Lucas Vieira Desenvolvimento de Software e Consultoria em Tecnologia da Informacao LTDA',
      address: ENDERECO,
      email: 'lucas.vieira.desenvolvimento.de.software.consultoria@um-dominio-bem-comprido.com.br',
      taxId: '12.345.678/0001-90',
    },
    paymentFields: [
      { id: 'a', label: 'Payment Method', value: 'Wire' },
      { id: 'b', label: 'Bank address', value: ENDERECO },
      { id: 'c', label: ROTULO_LONGO, value: 'Lucas Vieira Consultoria LTDA' },
      { id: 'd', label: 'IBAN', value: 'BR1800360305000010009795493C1' },
      { id: 'e', label: 'Payment link', value: SEM_ESPACO },
      { id: 'f', label: 'SWIFT Code', value: 'ABCDBRSP' },
    ],
  }
}

describe('PDF da invoice — posicao do texto', () => {
  beforeAll(() => {
    applyPlugin(jsPDF)
    ;(window as unknown as { jspdf: unknown }).jspdf = { jsPDF: Espiao }
  })

  beforeEach(() => {
    textos = []
    faixas = []
    fios = []
  })

  describe('campos curtos — o layout de sempre', () => {
    beforeEach(() => gerar(curto()))

    // Coordenadas medidas no codigo ANTERIOR ao INV-18. A correcao nao pode
    // mover nada de quem nunca teve o problema.
    it.each<[string, number, number, string]>([
      ['INVOICE', 15, 30, 'left'],
      ['Invoice #', 161, 20, 'right'],
      ['INV-001', 195, 20, 'right'],
      ['Issue date', 161, 25.5, 'right'],
      ['Oct 05, 2026', 195, 25.5, 'right'],
      ['Due date', 161, 31, 'right'],
      ['Nov 05, 2026', 195, 31, 'right'],
      ['FROM', 15, 48, 'left'],
      ['Lucas Vieira', 15, 53.5, 'left'],
      ['Tax ID 123', 15, 71.9, 'left'],
      ['BILL TO', 110, 48, 'left'],
      ['PAYMENT DETAILS', 15, 88.5, 'left'],
      ['Payment Method', 17.5, 93.5, 'left'],
      ['Wire', 192.5, 93.5, 'right'],
      ['IBAN', 17.5, 98.9, 'left'],
      ['BR1800360305000010009795493C1', 192.5, 98.9, 'right'],
      ['SWIFT Code', 17.5, 104.3, 'left'],
      ['ABCDBRSP', 192.5, 104.3, 'right'],
      ['DESCRIPTION', 18, 119.1, 'left'],
      ['Subtotal', 19, 142.6, 'left'],
      ['TOTAL DUE', 19, 157.4, 'left'],
      ['Lucas Vieira · lucas@example.com', 15, 285, 'left'],
      ['Page 1', 195, 285, 'right'],
    ])('"%s" continua em x=%d y=%d (%s)', (texto, x, y, alinhado) => {
      const t = unico(texto)
      expect(t.x).toBeCloseTo(x, 2)
      expect(t.y).toBeCloseTo(y, 2)
      expect(t.alinhado).toBe(alinhado)
    })

    it('a zebra do pagamento tem a altura de uma linha (5,4mm), nas linhas pares', () => {
      const zebra = faixas
        .filter((f) => deMargemAMargem(f) && f.y > 85 && f.y < 110)
        .map((f) => [f.x, +f.y.toFixed(2), +f.h.toFixed(2)])
      expect(zebra).toEqual([
        [15, 89.9, 5.4],
        [15, 100.7, 5.4],
      ])
    })

    it('os fios ficam onde estavam: cabecalho, pagamento e rodape', () => {
      expect(fios.map((f) => +f.y.toFixed(2))).toEqual([38, 82.5, 281])
    })

    it('cabe numa pagina, dentro das margens e sem sobreposicao', () => {
      expect(Math.max(...textos.map((t) => t.pagina))).toBe(1)
      esperarTudoDentroDasMargens()
      esperarNadaPorCima()
    })
  })

  describe('campos longos (INV-18)', () => {
    beforeEach(() => gerar(longo()))

    it('nenhum texto passa das margens de 15mm', () => {
      esperarTudoDentroDasMargens()
    })

    it('nenhum texto e escrito por cima de outro', () => {
      esperarNadaPorCima()
    })

    it('o valor longo do payment field quebra em mais linhas, sem perder texto', () => {
      const { valores } = linhasDoPagamento()
      const partes = valores.filter((v) => ENDERECO.includes(v.texto))
      expect(partes.length).toBeGreaterThan(1)
      expect(partes.map((p) => p.texto).join(' ')).toBe(ENDERECO)
      // Continua alinhado a direita, linha por linha, uma abaixo da outra.
      for (const p of partes) expect(p.direita).toBeCloseTo(DIREITA - 2.5, 2)
      const ys = partes.map((p) => p.y)
      expect([...ys].sort((a, b) => a - b)).toEqual(ys)
      expect(new Set(ys).size).toBe(ys.length)
    })

    it('a linha seguinte comeca abaixo da ultima linha do campo longo', () => {
      const { rotulos, valores } = linhasDoPagamento()
      const ultima = Math.max(...valores.filter((v) => ENDERECO.includes(v.texto)).map((v) => v.y))
      const seguinte = rotulos.find((r) => ROTULO_LONGO.startsWith(r.texto))
      expect(seguinte).toBeDefined()
      // 5,4mm e a altura de uma linha: a seguinte nao encosta na anterior.
      expect(seguinte!.y - ultima).toBeCloseTo(5.4, 2)
    })

    it('o rotulo longo tambem quebra, e nunca encosta no valor', () => {
      const { rotulos, valores } = linhasDoPagamento()
      const partes = rotulos.filter((r) => ROTULO_LONGO.includes(r.texto))
      expect(partes.length).toBeGreaterThan(1)
      expect(partes.map((p) => p.texto).join(' ')).toBe(ROTULO_LONGO)

      // Em TODO o bloco: a coluna do rotulo termina antes de a do valor comecar.
      const fimDosRotulos = Math.max(...rotulos.map((r) => r.direita))
      const inicioDosValores = Math.min(...valores.map((v) => v.esquerda))
      expect(inicioDosValores - fimDosRotulos).toBeGreaterThanOrEqual(6 - EPS)
    })

    it('palavra sem espaco maior que a coluna e partida, e nao vaza', () => {
      const { valores } = linhasDoPagamento()
      const partes = valores.filter((v) => SEM_ESPACO.includes(v.texto))
      expect(partes.length).toBeGreaterThan(1)
      expect(partes.map((p) => p.texto).join('')).toBe(SEM_ESPACO)
      for (const p of partes) expect(p.esquerda).toBeGreaterThanOrEqual(MARGEM)
    })

    it('a faixa da zebra cresce com o campo e para antes do seguinte', () => {
      const { rotulos } = linhasDoPagamento()
      // O rotulo longo e o terceiro campo (indice 2): tem zebra.
      const partes = rotulos.filter((r) => ROTULO_LONGO.includes(r.texto))
      const primeira = partes[0].y
      const ultima = partes[partes.length - 1].y
      const faixa = faixas.find((f) => deMargemAMargem(f) && Math.abs(f.y - (primeira - 3.6)) < EPS)
      expect(faixa, 'faixa da zebra do campo de rotulo longo').toBeDefined()
      expect(faixa!.h).toBeGreaterThan(5.4)
      // Cobre a ultima linha do campo (a faixa passa 1,8mm da linha de base)...
      expect(faixa!.y + faixa!.h).toBeCloseTo(ultima + 1.8, 2)
      // ...e termina exatamente onde a faixa do campo seguinte comecaria.
      expect(faixa!.y + faixa!.h).toBeCloseTo(unico('IBAN').y - 3.6, 2)
    })

    it('`Invoice #` de 43 caracteres fica numa linha, sem sobrepor o rotulo nem a marca', () => {
      const valor = unico('INV-2026-000000000123456789-ACME-CONSULTING')
      const rotulo = unico('Invoice #')
      expect(valor.direita).toBeCloseTo(DIREITA, 2)
      expect(rotulo.direita).toBeLessThan(valor.esquerda)
      expect(rotulo.esquerda).toBeGreaterThan(unico('INVOICE').direita)
      // Os tres rotulos continuam numa coluna so.
      expect(unico('Issue date').direita).toBeCloseTo(rotulo.direita, 2)
      expect(unico('Due date').direita).toBeCloseTo(rotulo.direita, 2)
      // Coube numa linha, entao o fio e o FROM nao saem do lugar.
      expect(fios[0].y).toBeCloseTo(38, 2)
      expect(unico('FROM').y).toBeCloseTo(48, 2)
    })

    it('o rodape e cortado com reticencias antes de `Page 1`', () => {
      const pagina = unico('Page 1')
      const rodape = textos.filter((t) => Math.abs(t.y - pagina.y) < EPS && t !== pagina)
      expect(rodape).toHaveLength(1)
      expect(rodape[0].texto.startsWith('Lucas Vieira Desenvolvimento')).toBe(true)
      expect(rodape[0].texto.endsWith('...')).toBe(true)
      expect(rodape[0].esquerda).toBeCloseTo(MARGEM, 2)
      expect(rodape[0].direita).toBeLessThan(pagina.esquerda)
    })
  })

  it('`Invoice #` que nao cabe nem com a coluna recuada quebra e empurra o fio e o FROM', async () => {
    const numero = `INV-${'0123456789'.repeat(12)}`
    await gerar({ ...curto(), invoiceNumber: numero })

    const partes = textos.filter((t) => t.pagina === 1 && t.negrito && t.y < 40 && numero.includes(t.texto))
    expect(partes.length).toBeGreaterThan(1)
    expect(partes.map((p) => p.texto).join('')).toBe(numero)

    const fimDoMeta = unico('Nov 05, 2026').y
    expect(fios[0].y).toBeGreaterThan(38)
    // As mesmas folgas do layout normal: 7mm ate o fio, 10mm do fio ao FROM.
    expect(fios[0].y - fimDoMeta).toBeCloseTo(7, 2)
    expect(unico('FROM').y - fios[0].y).toBeCloseTo(10, 2)
    esperarTudoDentroDasMargens()
    esperarNadaPorCima()
  })

  it('payment details mais alto que a folha continua na pagina seguinte, com rodape nas duas', async () => {
    await gerar({
      ...curto(),
      paymentFields: Array.from({ length: 24 }, (_, i) => ({
        id: `c${i}`,
        label: `Bank address ${i + 1}`,
        value: `${i + 1}. ${ENDERECO}`,
      })),
    })

    const paginas = Math.max(...textos.map((t) => t.pagina))
    expect(paginas).toBeGreaterThan(1)

    // Nada alem do proprio rodape (y=285) abaixo do fio do rodape (y=281).
    const noRodape = textos.filter((t) => t.y > ALTURA - 16)
    expect(noRodape.every((t) => Math.abs(t.y - (ALTURA - 12)) < EPS)).toBe(true)
    const invadindo = faixas.filter((f) => deMargemAMargem(f) && f.y + f.h > ALTURA - 16 + EPS)
    expect(invadindo).toEqual([])

    // Toda pagina tem o seu rodape, uma vez so.
    for (let p = 1; p <= paginas; p++) {
      const marcas = textos.filter((t) => t.pagina === p && t.texto === `Page ${p}`)
      expect(marcas, `rodape da pagina ${p}`).toHaveLength(1)
    }

    // Os 24 campos sairam, e nenhum pedaco se perdeu na troca de pagina.
    // Rotulo inteiro, numa linha: a coluna tem a largura do MAIOR rotulo, e
    // medir sem folga fazia o proprio maior rotulo quebrar em "Bank address"
    // / "10" (o `splitTextToSize` quebra na largura exata do texto).
    for (let i = 1; i <= 24; i++) {
      expect(textos.filter((t) => t.texto === `Bank address ${i}`)).toHaveLength(1)
    }
    // O rodape escreve em 8pt. Sem devolver o tamanho, tudo o que vinha depois
    // da troca de pagina saia menor que o resto do bloco (visto no PNG).
    const naSegunda = textos.filter((t) => t.pagina === 2 && t.y < 40)
    expect(naSegunda.length).toBeGreaterThan(0)
    expect(naSegunda.map((t) => t.tamanho)).toEqual(naSegunda.map(() => 9))
    esperarTudoDentroDasMargens()
    esperarNadaPorCima()
  })

  // O texto livre e o formato antigo dos dados de pagamento: some da tela
  // quando vazio, mas rascunho guardado de antes ainda o traz.
  it('o texto livre de pagamento tambem troca de pagina em vez de passar do rodape', async () => {
    await gerar({
      ...curto(),
      paymentFields: [],
      paymentDetails: Array.from({ length: 60 }, (_, i) => `Linha ${i + 1} do pagamento`).join('\n'),
    })

    expect(Math.max(...textos.map((t) => t.pagina))).toBe(2)
    const linhas = textos.filter((t) => /^Linha \d+ do pagamento$/.test(t.texto))
    expect(linhas).toHaveLength(60)
    expect(Math.max(...linhas.map((t) => t.y))).toBeLessThanOrEqual(ALTURA - 20 + EPS)
    expect(new Set(linhas.map((t) => t.tamanho))).toEqual(new Set([9]))
    for (const p of [1, 2]) {
      expect(textos.filter((t) => t.pagina === p && t.texto === `Page ${p}`)).toHaveLength(1)
    }
  })

  // DEFEITO CONHECIDO — INV-19, achado medindo o INV-18 e ainda aberto.
  // `desenharTotais` escreve em `fim da tabela + 10` sem olhar o fim da folha:
  // com 16 itens a caixa TOTAL DUE vai para y=302mm numa folha de 297, e o PDF
  // sai SEM o total. `it.fails` passa enquanto o defeito existir e quebra no
  // dia em que for corrigido — ai e so trocar por `it`.
  it.fails('INV-19: com 16 itens o TOTAL DUE continua dentro da folha', async () => {
    await gerar({
      ...curto(),
      items: Array.from({ length: 16 }, (_, i) => ({
        id: `i${i}`,
        description: `Item ${i + 1}`,
        quantity: '1',
        rate: '10',
      })),
    })
    expect(unico('TOTAL DUE').y).toBeLessThanOrEqual(ALTURA - 20)
  })
})
