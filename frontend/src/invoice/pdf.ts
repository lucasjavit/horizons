import {
  formatCents,
  lineAmountCents,
  parseAmountToCents,
  parseQuantity,
  sumCents,
} from './money'
import type { InvoiceDraft } from './types'

/**
 * Cores cruas de proposito: o PDF e sempre tinta sobre papel branco. Nao
 * acompanha o tema escuro do app nem le variavel CSS — documento impresso
 * nao tem tema.
 */
const FOREST: [number, number, number] = [0, 112, 74] // #00704A
const GOLD: [number, number, number] = [212, 160, 23] // #D4A017
const INK: [number, number, number] = [15, 20, 17]
const MUTED: [number, number, number] = [86, 104, 96]
const ZEBRA: [number, number, number] = [246, 248, 247]
const BRANCO: [number, number, number] = [255, 255, 255]

const MARGEM = 15

/** Data ISO para o formato longo em ingles, sem depender de biblioteca. */
function formatarData(iso: string): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia) return iso
  // Constroi em UTC e le em UTC: com hora local, fuso negativo volta um dia.
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function linhasValidas(draft: InvoiceDraft) {
  return draft.items
    .filter((i) => i.description.trim() || parseAmountToCents(i.rate) !== null)
    .map((i) => {
      const qtd = parseQuantity(i.quantity) ?? 0
      const rate = parseAmountToCents(i.rate) ?? 0
      return {
        descricao: i.description.trim() || '—',
        qtd,
        rateCents: rate,
        valorCents: lineAmountCents(qtd, rate),
      }
    })
}

export function invoiceTotalCents(draft: InvoiceDraft): number {
  return sumCents(linhasValidas(draft).map((l) => l.valorCents))
}

/**
 * Carrega o jsPDF sob demanda, guardando a promessa entre chamadas.
 *
 * O cache proprio guarda so o sucesso: em caso de falha ele e limpo, para a
 * proxima tentativa nao reusar a promessa rejeitada.
 *
 * Isso nao resolve o INV-05, e as duas saidas obvias foram testadas e
 * descartadas:
 *
 * - URL dinamica (`import('jspdf?t=...')`) faz o Vite parar de separar o
 *   chunk: o bundle principal salta de 320 para 329 KB, com os 400 KB do
 *   jsPDF dentro.
 * - `fetch(url, {cache:'reload'})` antes de reimportar reaquece o cache HTTP
 *   mas nao apaga o registro de modulos do ESM, que guarda a rejeicao para
 *   sempre. Medido: continua sem gerar o PDF.
 *
 * Por isso a mensagem de erro pede para recarregar a pagina, que e o que de
 * fato funciona. Trocar o carregamento sob demanda — que protege todo mundo
 * que so quer ler uma aula — por um retry que atinge quem teve falha de rede
 * seria mau negocio.
 */
let jsPdfCache: Promise<[
  typeof import('jspdf'),
  typeof import('jspdf-autotable'),
]> | null = null

function carregarJsPdf() {
  if (!jsPdfCache) {
    jsPdfCache = Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]) as Promise<[typeof import('jspdf'), typeof import('jspdf-autotable')]>
    jsPdfCache.catch(() => {
      jsPdfCache = null
    })
  }
  return jsPdfCache
}

export async function generateInvoicePdf(draft: InvoiceDraft): Promise<Blob> {
  // Import dinamico: as centenas de KB do jsPDF so descem quando alguem
  // realmente pede o PDF, e nao no carregamento da pagina.
  const [{ jsPDF }, { autoTable }] = await carregarJsPdf()

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const largura = doc.internal.pageSize.getWidth()
  const altura = doc.internal.pageSize.getHeight()
  const direita = largura - MARGEM

  // Barra da marca, sangrando de ponta a ponta.
  doc.setFillColor(...FOREST)
  doc.rect(0, 0, largura, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...FOREST)
  doc.text('INVOICE', MARGEM, 30)

  // Metadados a direita, rotulo e valor em duas colunas.
  const meta: Array<[string, string]> = [
    ['Invoice #', draft.invoiceNumber.trim() || '—'],
    ['Issue date', formatarData(draft.issueDate)],
    ['Due date', formatarData(draft.dueDate)],
  ]
  doc.setFontSize(9)
  let y = 20
  for (const [rotulo, valor] of meta) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(rotulo, direita - 34, y, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(valor, direita, y, { align: 'right' })
    y += 5.5
  }

  // Fio dourado: o acento entra como linha fina, nunca preenchimento nem
  // texto — dourado sobre branco da ~2,2:1 e reprova em AA.
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGEM, 38, direita, 38)

  const yPartes = desenharPartes(doc, draft, 48, largura)

  const linhas = linhasValidas(draft)
  autoTable(doc, {
    startY: yPartes + 4,
    margin: { left: MARGEM, right: MARGEM },
    head: [['DESCRIPTION', 'QTY', 'RATE', 'AMOUNT']],
    body: linhas.map((l) => [
      l.descricao,
      String(l.qtd),
      formatCents(l.rateCents, draft.currency),
      formatCents(l.valorCents, draft.currency),
    ]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: INK },
    headStyles: {
      fillColor: FOREST,
      textColor: BRANCO,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 16, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    didDrawPage: () => rodape(doc, draft, largura, altura),
  })

  // `lastAutoTable` existe em runtime (verificado), mas nao esta nos tipos
  // do jsPDF; o fallback cobre a borda de paginacao.
  const tabela = (doc as unknown as { lastAutoTable?: { finalY?: number } })
    .lastAutoTable
  const yTabela = tabela?.finalY ?? 120

  const yTotais = desenharTotais(doc, draft, yTabela + 10, direita)
  desenharBlocosFinais(doc, draft, yTotais + 18, largura)

  return doc.output('blob') as Blob
}

/** So o tipo: `import type` nao gera codigo, entao o jsPDF continua fora
 *  do bundle principal. */
type Doc = InstanceType<typeof import('jspdf').jsPDF>

/** FROM e BILL TO lado a lado. Devolve o Y em que os blocos terminaram. */
function desenharPartes(
  doc: Doc,
  draft: InvoiceDraft,
  yInicial: number,
  largura: number,
): number {
  const colunaLargura = (largura - MARGEM * 2 - 10) / 2
  const colunas: Array<{ titulo: string; linhas: string[]; x: number }> = [
    {
      titulo: 'FROM',
      x: MARGEM,
      linhas: [
        draft.from.name.trim(),
        ...draft.from.address.split('\n'),
        draft.from.email.trim(),
        draft.from.taxId.trim() ? `Tax ID ${draft.from.taxId.trim()}` : '',
      ].filter((l) => l.trim()),
    },
    {
      titulo: 'BILL TO',
      x: MARGEM + colunaLargura + 10,
      linhas: [
        draft.billTo.name.trim(),
        ...draft.billTo.address.split('\n'),
        draft.billTo.email.trim(),
      ].filter((l) => l.trim()),
    },
  ]

  let maiorY = yInicial
  for (const col of colunas) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(col.titulo, col.x, yInicial)

    let y = yInicial + 5.5
    doc.setFontSize(9)
    col.linhas.forEach((linha, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
      doc.setTextColor(...INK)
      // Quebra o que passar da largura da coluna.
      for (const parte of doc.splitTextToSize(linha, colunaLargura)) {
        doc.text(parte, col.x, y)
        y += 4.6
      }
    })
    maiorY = Math.max(maiorY, y)
  }
  return maiorY
}

/** Subtotal e a caixa do total. Devolve o Y final. */
function desenharTotais(
  doc: Doc,
  draft: InvoiceDraft,
  y: number,
  direita: number,
): number {
  const total = invoiceTotalCents(draft)
  const larguraCaixa = 78
  const x = direita - larguraCaixa

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('Subtotal', x + 4, y)
  doc.setTextColor(...INK)
  doc.text(formatCents(total, draft.currency), direita - 4, y, { align: 'right' })

  const yCaixa = y + 7
  doc.setFillColor(...FOREST)
  doc.rect(x, yCaixa, larguraCaixa, 12, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRANCO)
  doc.text('TOTAL DUE', x + 4, yCaixa + 7.8)
  doc.setFontSize(12)
  doc.text(formatCents(total, draft.currency), direita - 4, yCaixa + 7.8, {
    align: 'right',
  })

  return yCaixa + 12
}

/** PAYMENT DETAILS e NOTES, lado a lado. */
function desenharBlocosFinais(
  doc: Doc,
  draft: InvoiceDraft,
  yInicial: number,
  largura: number,
): void {
  const blocos = [
    { titulo: 'PAYMENT DETAILS', texto: draft.paymentDetails.trim() },
    { titulo: 'NOTES / TERMS', texto: draft.notes.trim() },
  ].filter((b) => b.texto)
  if (blocos.length === 0) return

  const colunaLargura = (largura - MARGEM * 2 - 10) / 2
  blocos.forEach((bloco, i) => {
    const x = i === 0 ? MARGEM : MARGEM + colunaLargura + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(bloco.titulo, x, yInicial)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    let y = yInicial + 5.5
    for (const linha of bloco.texto.split('\n')) {
      for (const parte of doc.splitTextToSize(linha, colunaLargura)) {
        doc.text(parte, x, y)
        y += 4.6
      }
    }
  })
}

function rodape(
  doc: Doc,
  draft: InvoiceDraft,
  largura: number,
  altura: number,
): void {
  const y = altura - 12
  doc.setDrawColor(...ZEBRA)
  doc.setLineWidth(0.3)
  doc.line(MARGEM, y - 4, largura - MARGEM, y - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)

  const esquerda = [draft.from.name.trim(), draft.from.email.trim()]
    .filter(Boolean)
    .join(' · ')
  if (esquerda) doc.text(esquerda, MARGEM, y)

  const pagina = doc.getCurrentPageInfo().pageNumber
  doc.text(`Page ${pagina}`, largura - MARGEM, y, { align: 'right' })
}
