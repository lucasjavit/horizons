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

/**
 * Linhas que entram no documento, com o valor ja calculado.
 *
 * Exportada de proposito: a previa na tela e o PDF leem DAQUI, e nao cada um
 * do seu jeito. Foi a mitigacao escolhida para o risco do INV-09 — dois
 * desenhos do mesmo documento divergirem com o tempo.
 */
export function linhasValidas(draft: InvoiceDraft) {
  return draft.items
    .filter(
      (i) => i.description.trim() || parseAmountToCents(i.rate, draft.currency) !== null,
    )
    .map((i) => {
      const qtd = parseQuantity(i.quantity, draft.currency) ?? 0
      const rate = parseAmountToCents(i.rate, draft.currency) ?? 0
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
 * Carrega o jsPDF sob demanda, por <script> classico.
 *
 * NAO usa `import()` de proposito, e isso e o INV-05: o registro de modulos
 * do ESM guarda a rejeicao para sempre, entao uma falha de rede deixava a
 * pessoa sem conseguir gerar o PDF ate recarregar a pagina — e a mensagem de
 * erro mandava tentar de novo, que era justamente o que nao funcionava.
 *
 * Quatro saidas foram testadas e descartadas antes desta:
 *
 * - URL dinamica no `import()` faz o Vite parar de separar o chunk (bundle
 *   principal de 320 para 329 KB, com os 400 KB do jsPDF dentro).
 * - `fetch(url, {cache:'reload'})` reaquece o cache HTTP, nao o registro do
 *   ESM.
 * - `<script type="module">` usa o MESMO registro, entao herda a rejeicao.
 * - Blob URL nao resolve o import relativo interno do chunk.
 *
 * O <script> classico e o unico que nao passa pelo registro de modulos:
 * falhou, o proximo `appendChild` vai a rede de novo. Medido.
 *
 * O custo: os arquivos vivem em `public/vendor/`, fora do pipeline do Vite,
 * entao nao tem hash de versao nem tree-shaking. Em troca, continuam fora do
 * bundle principal — que era a razao de usar import dinamico — e quem so quer
 * ler uma aula segue sem baixar nada disso.
 */

interface JanelaComJsPdf {
  jspdf?: { jsPDF: typeof import('jspdf').jsPDF }
}

/** Guarda so o sucesso: em caso de falha, a proxima tentativa vai a rede. */
let carregando: Promise<void> | null = null

function carregarScript(src: string): Promise<void> {
  return new Promise((ok, erro) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => ok()
    s.onerror = () => {
      // Remove o <script> falho: sem isso o DOM acumula tags mortas a cada
      // tentativa, e o navegador nao reusa a que ja falhou de qualquer forma.
      s.remove()
      erro(new Error(`falhou ao carregar ${src}`))
    }
    document.head.appendChild(s)
  })
}

async function carregarJsPdf(): Promise<typeof import('jspdf').jsPDF> {
  const janela = window as unknown as JanelaComJsPdf
  if (janela.jspdf?.jsPDF) return janela.jspdf.jsPDF

  if (!carregando) {
    carregando = (async () => {
      // O autotable depende do jsPDF ja estar em window, entao a ordem
      // importa e as duas nao podem ir em paralelo.
      await carregarScript('/vendor/jspdf.umd.min.js')
      await carregarScript('/vendor/jspdf.plugin.autotable.min.js')
    })()
    carregando.catch(() => {
      carregando = null
    })
  }
  await carregando

  const jsPDF = (window as unknown as JanelaComJsPdf).jspdf?.jsPDF
  if (!jsPDF) throw new Error('jsPDF nao ficou disponivel apos o carregamento')
  return jsPDF
}

export async function generateInvoicePdf(draft: InvoiceDraft): Promise<Blob> {
  // Import dinamico: as centenas de KB do jsPDF so descem quando alguem
  // realmente pede o PDF, e nao no carregamento da pagina.
  const jsPDF = await carregarJsPdf()

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
  const yPagamento = desenharPagamento(doc, draft, yPartes + 6, largura)

  const linhas = linhasValidas(draft)
  // O plugin UMD se instala como metodo do documento, em vez de exportar
  // uma funcao solta como a versao ESM.
  const comAutoTable = doc as unknown as {
    autoTable: (opcoes: Record<string, unknown>) => void
  }
  comAutoTable.autoTable({
    startY: yPagamento + 4,
    margin: { left: MARGEM, right: MARGEM },
    head: [['DESCRIPTION', 'HOURS', 'RATE', 'AMOUNT']],
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

  desenharTotais(doc, draft, yTabela + 10, direita)

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

/**
 * PAYMENT DETAILS, em linhas "rotulo -> valor", acima da tabela de itens.
 *
 * Fica antes dos itens de proposito: quem recebe a fatura precisa saber para
 * onde pagar, e essa informacao nao deve estar depois de uma tabela que pode
 * ocupar a pagina inteira.
 */
function desenharPagamento(
  doc: Doc,
  draft: InvoiceDraft,
  yInicial: number,
  largura: number,
): number {
  const linhas = draft.paymentFields.filter((c) => c.value.trim())
  const livre = draft.paymentDetails.trim()
  if (linhas.length === 0 && !livre) return yInicial

  const direita = largura - MARGEM
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('PAYMENT DETAILS', MARGEM, yInicial)

  let y = yInicial + 5
  doc.setFontSize(9)
  for (const c of linhas) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(c.label.trim() || '—', MARGEM, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    // Valor a direita, como na tela: alinhar os dois lados faz a lista ser
    // lida como tabela, nao como paragrafo.
    doc.text(c.value.trim(), direita, y, { align: 'right' })
    y += 4.6
  }

  if (livre) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...INK)
    for (const linha of livre.split('\n')) {
      for (const parte of doc.splitTextToSize(linha, largura - MARGEM * 2)) {
        doc.text(parte, MARGEM, y)
        y += 4.6
      }
    }
  }

  return y
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
