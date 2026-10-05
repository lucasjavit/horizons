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

/** Distancia entre linhas de um mesmo campo quebrado (9pt). E o passo que
 *  FROM / BILL TO ja usavam. */
const PASSO = 4.6

/**
 * Ultima linha de base em que ainda se escreve conteudo, contada do fim da
 * folha. O fio do rodape fica a 16mm do fim; os 20 deixam a faixa da zebra
 * (que desce 1,8mm abaixo da linha de base) terminar antes dele.
 */
const RESERVA_DO_RODAPE = 20

/** A maior largura, em mm, entre os textos — na fonte que estiver ativa. */
function maiorLargura(doc: Doc, textos: string[]): number {
  return textos.reduce((maior, t) => Math.max(maior, doc.getTextWidth(t)), 0)
}

/**
 * Quebra o texto em linhas de ate `max` mm, na fonte ativa. Palavra sem
 * espaco maior que `max` (e-mail, IBAN, URL) e partida no meio.
 *
 * Mede ANTES de quebrar, e isso nao e otimizacao: o `splitTextToSize` nao usa
 * a mesma conta do `getTextWidth` (um aplica kerning, o outro nao), entao ele
 * quebra texto que cabe. Com a coluna na largura exata do maior rotulo,
 * "Bank address 10" saia como "Bank address" / "10"; meio milimetro de folga
 * ainda quebrava "Co-Fsmy VTLSTto0 TdFhJsLd". Medido nos dois casos.
 */
function quebrar(doc: Doc, texto: string, max: number): string[] {
  if (!texto.includes('\n') && doc.getTextWidth(texto) <= max) return [texto]
  // O trecho partido as vezes volta com o espaco da quebra no fim, e num texto
  // alinhado a direita esse espaco empurra a linha 0,9mm para dentro.
  return (doc.splitTextToSize(texto, max) as string[]).map((l) => l.trimEnd())
}

/**
 * Corta o texto para caber em `max`, com reticencias. Mede na fonte ativa.
 *
 * Tres pontos ASCII, e nao o caractere de reticencias: ele esta fora do
 * Latin-1, e as fontes padrao do PDF (helvetica) nao tem como desenha-lo.
 */
function encurtar(doc: Doc, texto: string, max: number): string {
  if (doc.getTextWidth(texto) <= max) return texto
  let corte = texto.length
  while (corte > 0 && doc.getTextWidth(`${texto.slice(0, corte).trimEnd()}...`) > max) {
    corte -= 1
  }
  return `${texto.slice(0, corte).trimEnd()}...`
}

/**
 * A logo da empresa, ou a palavra INVOICE quando nao houver.
 *
 * A altura e fixa (14mm) e a largura sai da proporcao da imagem, para logo
 * larga e logo alta ocuparem o mesmo espaco vertical. Se a imagem falhar por
 * qualquer motivo, cai no texto — uma fatura sem cabecalho seria pior que uma
 * sem logo.
 */
function desenharMarca(doc: Doc, draft: InvoiceDraft): void {
  const logo = draft.from.logo
  if (logo) {
    try {
      const props = doc.getImageProperties(logo)
      const altura = 14
      const largura = (props.width / props.height) * altura
      doc.addImage(logo, 'PNG', MARGEM, 18, Math.min(largura, 60), altura)
      return
    } catch {
      // cai no texto abaixo
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor(...FOREST)
  doc.text('INVOICE', MARGEM, 30)
}

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
  if (!jsPDF) throw new Error('jsPDF did not become available after loading')
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

  desenharMarca(doc, draft)

  // Metadados a direita, rotulo e valor em duas colunas.
  const meta: Array<[string, string]> = [
    ['Invoice #', draft.invoiceNumber.trim() || '—'],
    ['Issue date', formatarData(draft.issueDate)],
    ['Due date', formatarData(draft.dueDate)],
  ]
  doc.setFontSize(9)
  // O valor e medido antes de desenhar (INV-18): um `Invoice #` de 43
  // caracteres era escrito por cima do proprio rotulo. A coluna do rotulo
  // fica onde sempre esteve (34mm da margem) enquanto o valor couber, e so
  // entao recua para a esquerda — ate o limite da marca, que ocupa no maximo
  // 60mm. Passou disso, o valor quebra e empurra o resto da folha para baixo.
  // A medida vem com a fonte de cada coluna ativa: negrito e ~8% mais largo.
  const VAO_META = 3
  doc.setFont('helvetica', 'normal')
  const larguraRotulos = maiorLargura(doc, meta.map(([rotulo]) => rotulo))
  doc.setFont('helvetica', 'bold')
  const tetoValor = direita - (MARGEM + 60 + 5) - larguraRotulos - VAO_META
  const valoresMeta = meta.map(([, valor]) => quebrar(doc, valor, tetoValor))
  const xRotulo = direita - Math.max(34, maiorLargura(doc, valoresMeta.flat()) + VAO_META)

  let y = 20
  meta.forEach(([rotulo], i) => {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(rotulo, xRotulo, y, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    valoresMeta[i].forEach((parte, k) => {
      doc.text(parte, direita, y + k * PASSO, { align: 'right' })
    })
    y += 5.5 + (valoresMeta[i].length - 1) * PASSO
  })
  // Zero quando nenhum valor quebrou — o fio e FROM ficam onde sempre ficaram.
  const desceu = y - (20 + 5.5 * meta.length)

  // Fio dourado: o acento entra como linha fina, nunca preenchimento nem
  // texto — dourado sobre branco da ~2,2:1 e reprova em AA.
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGEM, 38 + desceu, direita, 38 + desceu)

  const yPartes = desenharPartes(doc, draft, 48 + desceu, largura)
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
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 18, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 34, halign: 'right' },
    },
    // O `halign` de columnStyles vale so para o corpo: o cabecalho ficava a
    // esquerda enquanto os valores iam para a direita — medido, RATE
    // terminava 46pt antes do valor. `headStyles` dentro de columnStyles nao
    // e lido pelo autotable; alinhar celula a celula e o que funciona.
    didParseCell: (dados: {
      section: string
      column: { index: number }
      cell: { styles: { halign: string } }
    }) => {
      if (dados.section === 'head' && dados.column.index > 0) {
        dados.cell.styles.halign = 'right'
      }
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
  // Largura cheia, igual ao cabecalho da tabela: as duas faixas verdes
  // emolduram os itens.
  const x = MARGEM
  const larguraCaixa = direita - MARGEM

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
 *
 * Rotulo e valor tem cada um a sua coluna, e os dois quebram (INV-18). Antes
 * o valor era um `doc.text` so, alinhado a direita: um endereco de 170
 * caracteres passava por cima do rotulo e saia da folha pela esquerda.
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
  const altura = doc.internal.pageSize.getHeight()
  const fimUtil = altura - RESERVA_DO_RODAPE

  // O rodape da folha que fica para tras e desenhado aqui: o autotable so
  // chama `didDrawPage` nas paginas em que ELE desenha, e a tabela comeca
  // depois deste bloco.
  const novaPagina = (): number => {
    rodape(doc, draft, largura, altura)
    doc.addPage()
    // O rodape escreve em 8pt, e o tamanho da fonte e estado do documento:
    // sem isto, o que vem depois da troca de pagina sairia menor.
    doc.setFontSize(9)
    // A faixa da zebra sobe 3,6mm da linha de base: assim ela comeca na margem.
    return MARGEM + 3.6
  }

  // Titulo sozinho no pe da folha, com as linhas na seguinte, seria pior que
  // o bloco inteiro na seguinte.
  if (yInicial + 11 > fimUtil) yInicial = novaPagina() - 3.6

  // Mesmo fio dourado do cabecalho, separando as partes do pagamento.
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.line(MARGEM, yInicial, direita, yInicial)

  const yTitulo = yInicial + 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('PAYMENT DETAILS', MARGEM, yTitulo)

  let y = yTitulo + 5
  doc.setFontSize(9)
  const ALTURA = 5.4
  const RECUO = 2.5
  const VAO = 6
  const rotulos = linhas.map((c) => c.label.trim() || '—')

  // A coluna do rotulo tem a largura do maior rotulo, ate o teto de 38% —
  // rotulo curto (o caso comum: "IBAN", "SWIFT Code") deixa quase a linha
  // toda para o valor, e um rotulo de 75 caracteres nao espreme o endereco.
  // As medidas saem na fonte ATIVA: a fonte e trocada antes de cada uma,
  // senao o negrito estoura a coluna.
  const interna = direita - MARGEM - RECUO * 2
  doc.setFont('helvetica', 'normal')
  const larguraRotulo = Math.min(interna * 0.38, maiorLargura(doc, rotulos))
  const larguraValor = interna - larguraRotulo - VAO

  linhas.forEach((c, i) => {
    doc.setFont('helvetica', 'normal')
    const rotulo = quebrar(doc, rotulos[i], larguraRotulo)
    doc.setFont('helvetica', 'bold')
    const valor = quebrar(doc, c.value.trim(), larguraValor)
    const total = Math.max(rotulo.length, valor.length)

    // Um campo pode ser mais alto que o resto da folha (ou que a folha
    // inteira), entao ele e desenhado em trechos: o que cabe aqui, e o resto
    // na pagina seguinte. Campo de uma linha da uma volta so, com a mesma
    // altura de 5,4mm de sempre.
    let feitas = 0
    while (feitas < total) {
      if (y > fimUtil) y = novaPagina()
      const cabem = Math.floor((fimUtil - y) / PASSO) + 1
      const n = Math.min(cabem, total - feitas)
      const alturaDoTrecho = ALTURA + (n - 1) * PASSO

      // Mesma zebra da tabela de itens. A faixa e desenhada antes do texto,
      // senao cobriria o que ja foi escrito.
      if (i % 2 === 0) {
        doc.setFillColor(...ZEBRA)
        doc.rect(MARGEM, y - 3.6, direita - MARGEM, alturaDoTrecho, 'F')
      }
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...MUTED)
      rotulo.slice(feitas, feitas + n).forEach((parte, k) => {
        doc.text(parte, MARGEM + RECUO, y + k * PASSO)
      })
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...INK)
      // Valor a direita: alinhar os dois lados faz a lista ser lida como
      // tabela, nao como paragrafo.
      valor.slice(feitas, feitas + n).forEach((parte, k) => {
        doc.text(parte, direita - RECUO, y + k * PASSO, { align: 'right' })
      })
      y += alturaDoTrecho
      feitas += n
    }
  })

  if (livre) {
    doc.setFont('helvetica', 'normal')
    for (const linha of livre.split('\n')) {
      for (const parte of doc.splitTextToSize(linha, largura - MARGEM * 2)) {
        if (y > fimUtil) y = novaPagina()
        // Dentro do laco porque o rodape, na troca de pagina, deixa a cor dele.
        doc.setTextColor(...INK)
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
  const pagina = `Page ${doc.getCurrentPageInfo().pageNumber}`
  // Rodape e uma linha so, por definicao: nome e e-mail compridos sao
  // cortados com reticencias em vez de quebrar (INV-18). Os dois ja aparecem
  // inteiros no bloco FROM; aqui eles so identificam a folha.
  const cabe = largura - MARGEM * 2 - doc.getTextWidth(pagina) - 6
  if (esquerda) doc.text(encurtar(doc, esquerda, cabe), MARGEM, y)

  doc.text(pagina, largura - MARGEM, y, { align: 'right' })
}
