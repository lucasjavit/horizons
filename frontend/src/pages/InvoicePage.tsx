import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { SelectField, TextAreaField, TextField } from '../components/invoice/Field'
import { Hint } from '../components/invoice/Hint'
import { InvoicePreview } from '../components/invoice/InvoicePreview'
import { IssuerFields } from '../components/invoice/IssuerFields'
import { LineItemsEditor } from '../components/invoice/LineItemsEditor'
import type { Company } from '../invoice/companies'
import { loadCompanies, saveCompanies } from '../invoice/companies'
import { CURRENCIES, isCurrencyCode } from '../invoice/currencies'
import { formatCents } from '../invoice/money'
import { generateInvoicePdf, invoiceTotalCents } from '../invoice/pdf'
import { useInvoiceDraft } from '../invoice/useInvoiceDraft'
import { dueDateWarning, validateDraft, validateItem } from '../invoice/validate'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type EstadoPdf = 'ocioso' | 'gerando' | 'pronto' | 'erro'

/**
 * Quanto tempo o formulario fica bloqueado ao gerar o PDF.
 *
 * Nao e enfeite: a geracao real leva de 13ms (jsPDF ja carregado) a 63ms
 * (primeira vez, baixando o chunk). Bloquear so durante isso e inutil —
 * o botao reabre entre dois cliques do mesmo dedo, e a pessoa consegue
 * editar um campo no meio e receber um PDF com os dados de antes.
 *
 * 600ms e curto o bastante para nao irritar e longo o bastante para o olho
 * registrar que algo aconteceu.
 */
const MIN_BLOQUEIO_MS = 600

/**
 * Chave de erro -> id do input, para levar o foco ao primeiro campo
 * invalido. A ordem de insercao em validateDraft acompanha a ordem visual
 * dos campos, entao a primeira chave e mesmo o primeiro erro da tela.
 */
const ID_DO_CAMPO: Record<string, string> = {
  invoiceNumber: 'invoice-number',
  issueDate: 'issue-date',
  'from.name': 'from-name',
  'from.email': 'from-email',
  'billTo.name': 'billto-name',
  'billTo.email': 'billto-email',
}

export function InvoicePage() {
  useDocumentTitle('Invoice generator')

  const inv = useInvoiceDraft()
  const { draft } = inv

  // Campos so mostram erro depois de tocados; ao enviar, todos sao marcados
  // de uma vez. Acusar erro enquanto a pessoa digita pela primeira vez e
  // punitivo; esconder ate o envio esconde o problema.
  const [tocados, setTocados] = useState<Record<string, boolean>>({})
  const [enviado, setEnviado] = useState(false)
  const [estadoPdf, setEstadoPdf] = useState<EstadoPdf>('ocioso')
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)

  // Trava sincrona da geracao. Parece redundante com `estadoPdf === 'gerando'`
  // no `disabled` do botao, mas nao e: `setEstadoPdf` e assincrono, entao uma
  // rajada de cliques no mesmo tick do event loop entra em `baixar` tres vezes
  // antes de o React re-renderizar o `disabled` uma unica vez. O ref muda no
  // ato e barra o segundo clique; o `disabled` e o que a pessoa ve.
  const gerando = useRef(false)

  // O navegador tira o foco de um elemento que vira `disabled`, e o React nao
  // devolve quando o atributo sai. Sem isto, quem baixa a invoice pelo teclado
  // e jogado para o topo do documento e precisa retabular a pagina inteira
  // (INV-06).
  const botaoBaixar = useRef<HTMLButtonElement>(null)

  // Enquanto gera, o formulario inteiro fica somente leitura: editar no meio
  // produziria um PDF com os dados capturados no clique, sem nada avisando.
  //
  // Precisa ser estado, e nao o ref: mudar um ref nao re-renderiza, entao o
  // `disabled` nunca chegaria ao DOM. O ref decide (sincrono, no clique);
  // este estado mostra.
  //
  // Tambem nao pode ser `estadoPdf === 'gerando'`: o estado vira 'pronto'
  // assim que o arquivo sai, e a trava so cai depois de MIN_BLOQUEIO_MS.
  const [bloqueado, setBloqueado] = useState(false)

  // Um bloco aberto por vez. Comeca no 1: e onde a pessoa comeca a preencher.
  const [aberto, setAberto] = useState<number | null>(1)

  // Empresas emissoras salvas. Ficam fora do rascunho de propósito: valem
  // para todas as invoices, e nao so para a que esta sendo escrita.
  const [companies, setCompanies] = useState<Company[]>(() => loadCompanies())
  const [companyId, setCompanyId] = useState<string | null>(null)

  const salvarEmpresa = useCallback((c: Company) => {
    setCompanies((lista) => {
      const existe = lista.some((x) => x.id === c.id)
      const nova = existe ? lista.map((x) => (x.id === c.id ? c : x)) : [...lista, c]
      saveCompanies(nova)
      return nova
    })
    setCompanyId(c.id)
    // Copia para o rascunho: o PDF le o `from`, nao a lista de empresas.
    inv.setFromTodo({ name: c.name, address: c.address, email: c.email, taxId: c.taxId })
  }, [inv])

  const escolherEmpresa = useCallback((id: string | null) => {
    setCompanyId(id)
    const c = companies.find((x) => x.id === id)
    inv.setFromTodo(
      c
        ? { name: c.name, address: c.address, email: c.email, taxId: c.taxId }
        : { name: '', address: '', email: '', taxId: '' },
    )
  }, [companies, inv])

  const apagarEmpresa = useCallback((id: string) => {
    setCompanies((lista) => {
      const nova = lista.filter((x) => x.id !== id)
      saveCompanies(nova)
      return nova
    })
    // Apagar a empresa selecionada limpa o From, senao a invoice ficaria com
    // os dados de uma empresa que nao existe mais na lista.
    setCompanyId((atual) => (atual === id ? null : atual))
    inv.setFromTodo({ name: '', address: '', email: '', taxId: '' })
  }, [inv])

  const erros = useMemo(() => validateDraft(draft), [draft])

  // Erros de linha aparecem assim que o valor e invalido, sem esperar o
  // envio: diferente de campo em branco, um numero negativo ja e erro no
  // momento em que foi digitado.
  const errosDeLinha = useMemo(() => {
    const r: Record<string, string | undefined> = {}
    for (const item of draft.items) Object.assign(r, validateItem(item, draft.currency))
    return r
  }, [draft.items, draft.currency])
  const aviso = useMemo(() => dueDateWarning(draft), [draft])
  const total = useMemo(() => invoiceTotalCents(draft), [draft])

  const erro = useCallback(
    (campo: string) =>
      enviado || tocados[campo] ? erros[campo] : undefined,
    [enviado, tocados, erros],
  )

  const tocar = useCallback(
    (campo: string) => () => setTocados((t) => ({ ...t, [campo]: true })),
    [],
  )

  // INV-07: sem isto, "Invoice downloaded." fica na tela para sempre e
  // encobre o aviso de autosave, mentindo sobre uma invoice que ja mudou.
  useEffect(() => {
    setEstadoPdf((atual) => (atual === 'pronto' ? 'ocioso' : atual))
  }, [draft])

  const baixar = useCallback(async () => {
    // Antes de tudo: se ja ha uma geracao em andamento, o clique nao existe.
    if (gerando.current) return

    setEnviado(true)
    setErroPdf(null)

    if (Object.keys(erros).length > 0) {
      // Leva o foco ao primeiro campo invalido, em vez de so pintar de
      // vermelho um campo que pode estar fora da tela.
      //
      // O id vem do mapa: procurar por [aria-invalid] logo apos setEnviado
      // nao acha nada, porque o React ainda nao re-renderizou o atributo.
      const primeiraChave = Object.keys(erros).find((k) => k in ID_DO_CAMPO)
      const alvo = primeiraChave
        ? document.getElementById(ID_DO_CAMPO[primeiraChave])
        : // So o erro de itens sobrou: leva ao primeiro campo de descricao.
          document.querySelector<HTMLElement>('#items-heading ~ ul input')
      alvo?.focus()
      alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    // So marca a trava depois da validacao: formulario invalido nao inicia
    // geracao nenhuma e o botao continua clicavel, como manda o padrao da
    // casa (recusa silenciosa e pior que erro explicado).
    gerando.current = true
    setBloqueado(true)
    setEstadoPdf('gerando')
    const comecou = performance.now()
    try {
      const blob = await generateInvoicePdf(draft)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${draft.invoiceNumber.trim() || 'draft'}.pdf`
      a.click()
      // Revoga depois: revogar antes do clique ser processado cancela o
      // download em alguns navegadores.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setEstadoPdf('pronto')
    } catch {
      setEstadoPdf('erro')
      // Desde o INV-05 o retry funciona de verdade: o jsPDF entra por
      // <script> classico, que nao cacheia a falha como o import() do ESM.
      setErroPdf('Could not generate the PDF. Check your connection and try again.')
    } finally {
      // Segura a trava por um tempo minimo. Sem isso ela nao serve para nada:
      // a geracao leva 13ms com o jsPDF ja carregado, entao o botao fecha e
      // reabre entre dois cliques do mesmo dedo — medido, tres cliques a cada
      // 150ms davam tres PDFs.
      //
      // O tempo tambem sustenta o bloqueio dos campos: um piscar de 13ms nao
      // seria percebido, e a pessoa poderia editar no meio da geracao e
      // receber um PDF com os dados antigos.
      const passou = performance.now() - comecou
      const resta = Math.max(0, MIN_BLOQUEIO_MS - passou)
      window.setTimeout(() => {
        gerando.current = false
        setBloqueado(false)
        // Devolve o foco so se ele continua perdido no body. A checagem vai
        // dentro do frame seguinte, e nao antes: entre o clique e este ponto
        // a pessoa pode ter ido para outro campo, e roubar o foco de volta
        // seria pior que a perda que estamos consertando.
        requestAnimationFrame(() => {
          if (document.activeElement === document.body) {
            botaoBaixar.current?.focus()
          }
        })
      }, resta)
    }
  }, [draft, erros])

  return (
    <main id="conteudo" tabIndex={-1}>
      {/* Duas colunas no desktop: formulario a esquerda, documento a direita.
          A previa e o unico diferencial real contra um concorrente que tambem
          e um formulario — por isso ela ocupa metade da tela, e nao um canto. */}
      <div className="mx-auto grid max-w-[100rem] items-start gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="px-4 py-8 sm:px-8 lg:py-12">
          <div className="mx-auto max-w-2xl">
            <header className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Free invoice generator
              </h1>
              <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
                Professional invoices for international clients — ready in under
                a minute.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                {['No sign-up', 'Nothing leaves your browser', '7 currencies'].map(
                  (s) => (
                    <li
                      key={s}
                      className="rounded-full border px-2.5 py-1"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {s}
                    </li>
                  ),
                )}
              </ul>
            </header>

            <fieldset
              disabled={bloqueado}
              className="flex min-w-0 flex-col gap-4 border-0 p-0"
            >
              <Bloco
                numero={1}
                titulo="Invoice details"
                resumo={`${draft.invoiceNumber.trim() || 'No number'} · ${draft.currency}`}
                dica={{
                  title: 'Invoice details',
                  texto:
                    'The invoice number identifies this charge — keep it sequential (INV-0001, INV-0002) so you and your client can track payments. The due date sets when payment is expected; 30 days is the common default.',
                }}
                aberto={aberto === 1}
                onToggle={() => setAberto(aberto === 1 ? null : 1)}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="invoice-number"
                    label="Invoice number"
                    value={draft.invoiceNumber}
                    onChange={(v) => inv.setCampo('invoiceNumber', v)}
                    onBlur={tocar('invoiceNumber')}
                    error={erro('invoiceNumber')}
                    placeholder="INV-0001"
                  />
                  <SelectField
                    id="currency"
                    label="Currency"
                    value={draft.currency}
                    onChange={(v) => {
                      if (isCurrencyCode(v)) inv.setCurrency(v)
                    }}
                    options={CURRENCIES.map((c) => ({
                      value: c.code,
                      label: c.label,
                    }))}
                  />
                  <TextField
                    id="issue-date"
                    label="Issue date"
                    type="date"
                    value={draft.issueDate}
                    onChange={(v) => inv.setCampo('issueDate', v)}
                    onBlur={tocar('issueDate')}
                    error={erro('issueDate')}
                  />
                  <TextField
                    id="due-date"
                    label="Due date"
                    type="date"
                    value={draft.dueDate}
                    onChange={(v) => inv.setCampo('dueDate', v)}
                    hint={aviso ?? undefined}
                  />
                </div>
              </Bloco>

              <Bloco
                numero={2}
                titulo="Who is billing whom"
                dica={{
                  title: 'Who is billing whom',
                  texto:
                    'Use the full legal name and address on both sides — mismatched details are the most common reason an invoice sits unpaid in a finance department. The Tax ID is optional, but many companies need it to process payment abroad.',
                }}
                resumo={
                  draft.from.name.trim() || draft.billTo.name.trim()
                    ? `${draft.from.name.trim() || '—'} → ${draft.billTo.name.trim() || '—'}`
                    : 'Not filled in yet'
                }
                aberto={aberto === 2}
                onToggle={() => setAberto(aberto === 2 ? null : 2)}
              >
                <div className="grid gap-8 sm:grid-cols-2">
                  <section aria-labelledby="from-heading">
                    <h3
                      id="from-heading"
                      className="mb-3 text-[0.7rem] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      From
                    </h3>
                    <IssuerFields
                      from={draft.from}
                      companies={companies}
                      selectedId={companyId}
                      erroNome={erro('from.name')}
                      erroEmail={erro('from.email')}
                      onChangeCampo={inv.setFrom}
                      onSelect={escolherEmpresa}
                      onSave={salvarEmpresa}
                      onDelete={apagarEmpresa}
                    />
                  </section>

                  <section aria-labelledby="billto-heading">
                    <h3
                      id="billto-heading"
                      className="mb-3 text-[0.7rem] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Bill to
                    </h3>
                    <div className="flex flex-col gap-4">
                      <TextField
                        id="billto-name"
                        label="Client name or company"
                        value={draft.billTo.name}
                        onChange={(v) => inv.setBillTo('name', v)}
                        onBlur={tocar('billTo.name')}
                        error={erro('billTo.name')}
                      />
                      <TextAreaField
                        id="billto-address"
                        label="Client address"
                        value={draft.billTo.address}
                        onChange={(v) => inv.setBillTo('address', v)}
                        placeholder={'Street, number\nCity, State, ZIP\nCountry'}
                      />
                      <TextField
                        id="billto-email"
                        label="Client email"
                        type="email"
                        value={draft.billTo.email}
                        onChange={(v) => inv.setBillTo('email', v)}
                        onBlur={tocar('billTo.email')}
                        error={erro('billTo.email')}
                        hint="Where the invoice will be sent."
                      />
                    </div>
                  </section>
                </div>
              </Bloco>

              <Bloco
                numero={3}
                titulo="Items"
                dica={{
                  title: 'Items',
                  texto:
                    'Hours × hourly rate gives the line amount. Fractions work, so 2.5 hours is fine. Each line is rounded to the cent before being summed, so the printed total always matches the sum of the printed lines.',
                }}
                resumo={`${draft.items.length} ${draft.items.length === 1 ? 'line' : 'lines'} · ${formatCents(total, draft.currency)}`}
                aberto={aberto === 3}
                onToggle={() => setAberto(aberto === 3 ? null : 3)}
              >
                <LineItemsEditor
                  items={draft.items}
                  currency={draft.currency}
                  error={enviado ? erros.items : undefined}
                  itemErrors={errosDeLinha}
                  onChange={inv.setItem}
                  onAdd={inv.addItem}
                  onRemove={inv.removeItem}
                  onMove={inv.moveItem}
                />
              </Bloco>

              <Bloco
                numero={4}
                titulo="Payment & notes"
                dica={{
                  title: 'Payment & notes',
                  texto:
                    'Payment details is where you say how to be paid: bank, IBAN, SWIFT, or a service like Wise or Payoneer. Notes carry the terms — late fees, reference period, or anything your client asked to see on the document.',
                }}
                resumo={
                  draft.paymentDetails.trim() || draft.notes.trim()
                    ? 'Filled in'
                    : 'Optional'
                }
                aberto={aberto === 4}
                onToggle={() => setAberto(aberto === 4 ? null : 4)}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextAreaField
                    id="payment-details"
                    label="Payment details"
                    value={draft.paymentDetails}
                    onChange={(v) => inv.setCampo('paymentDetails', v)}
                    rows={4}
                    placeholder={'Bank name\nIBAN / Account\nSWIFT / Routing\nWise, Payoneer…'}
                  />
                  <TextAreaField
                    id="notes"
                    label="Notes / terms"
                    value={draft.notes}
                    onChange={(v) => inv.setCampo('notes', v)}
                    rows={4}
                    placeholder="Payment due within 30 days."
                  />
                </div>
              </Bloco>
            </fieldset>

            <div
              className="mt-8 flex flex-wrap items-center gap-3 border-t pt-6"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-sm font-semibold uppercase tracking-wide">
                Total
              </span>
              <span
                aria-live="polite"
                className="text-2xl font-bold tabular-nums"
                style={{ color: 'var(--brand)' }}
              >
                {formatCents(total, draft.currency)}
              </span>

              <span className="ml-auto flex flex-wrap items-center gap-3">
                <button
                  ref={botaoBaixar}
                  type="button"
                  onClick={() => void baixar()}
                  disabled={bloqueado}
                  aria-busy={bloqueado}
                  className="rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-90"
                  style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
                >
                  {bloqueado ? 'Preparing PDF…' : 'Download PDF'}
                </button>

                {!confirmandoLimpeza ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoLimpeza(true)}
                    className="rounded-md border px-4 py-2.5 text-sm font-medium"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Clear
                  </button>
                ) : (
                  <span
                    role="alert"
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    Clear everything?
                    <button
                      type="button"
                      onClick={() => {
                        inv.reset()
                        setTocados({})
                        setEnviado(false)
                        setEstadoPdf('ocioso')
                        setCompanyId(null)
                        setConfirmandoLimpeza(false)
                      }}
                      className="rounded-md px-3 py-1.5 text-sm font-semibold"
                      style={{ background: WARN_INK, color: '#fff' }}
                    >
                      Yes, clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoLimpeza(false)}
                      className="rounded-md border px-3 py-1.5 text-sm font-medium"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Keep it
                    </button>
                  </span>
                )}
              </span>

              <p
                role="status"
                aria-live="polite"
                className="w-full text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                {estadoPdf === 'pronto'
                  ? 'Invoice downloaded.'
                  : inv.salvo
                    ? 'Draft saved in this browser.'
                    : 'Saving…'}
              </p>

              {erroPdf && (
                <p role="alert" className="w-full text-sm" style={{ color: WARN_INK }}>
                  {erroPdf}
                </p>
              )}
            </div>

            <footer
              className="mt-12 border-t pt-6 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <p>
                Horizons also has free, in-depth System Design study tracks (in
                Portuguese).{' '}
                <Link
                  to="/"
                  className="font-medium underline"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  Take a look
                </Link>
                .
              </p>
            </footer>
          </div>
        </div>

        {/* A previa. No celular vem depois do formulario, sem posicao fixa. */}
        <aside
          className="px-4 pb-12 sm:px-8 lg:sticky lg:top-[57px] lg:max-h-[calc(100dvh-57px)] lg:overflow-y-auto lg:py-10"
          style={{ background: 'var(--surface-sunken)' }}
          aria-labelledby="preview-heading"
        >
          <h2
            id="preview-heading"
            className="mb-4 pt-8 text-[0.7rem] font-bold uppercase tracking-widest lg:pt-0"
            style={{ color: 'var(--text-muted)' }}
          >
            Live preview
          </h2>
          <InvoicePreview draft={draft} />
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            The downloaded PDF is the final version.
          </p>
        </aside>
      </div>
    </main>
  )
}

/**
 * Bloco numerado que fecha em acordeao.
 *
 * Fechado, mostra um resumo do que ja foi preenchido — e o que derruba a
 * altura no celular de 2.355px para ~1.000px sem esconder informacao: quem
 * quer conferir abre, e quem so quer seguir ve o resumo.
 */
function Bloco({
  numero,
  titulo,
  resumo,
  dica,
  aberto,
  onToggle,
  children,
}: {
  numero: number
  titulo: string
  resumo: string
  dica?: { title: string; texto: string }
  aberto: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const idConteudo = `bloco-${numero}`
  return (
    <section
      className="rounded-xl border"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      {/* A dica fica FORA do <button>: botao dentro de botao e HTML
          invalido, e o leitor de tela anuncia so o de fora. */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <h2 className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={aberto}
          aria-controls={idConteudo}
          className="flex w-full items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {numero}
          </span>
          <span className="font-semibold tracking-tight">{titulo}</span>
          <span
            className="ml-auto truncate text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {resumo}
          </span>
          <span aria-hidden className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
            {aberto ? '▲' : '▼'}
          </span>
        </button>
        </h2>
        {dica && <Hint title={dica.title}>{dica.texto}</Hint>}
      </div>
      {/* hidden em vez de desmontar: o conteudo continua no DOM, entao o
          rascunho nao se perde e o Ctrl+F do navegador continua achando. */}
      <div id={idConteudo} hidden={!aberto} className="px-4 pb-5 sm:px-5">
        {children}
      </div>
    </section>
  )
}
