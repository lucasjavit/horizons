import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { SelectField, TextAreaField, TextField } from '../components/invoice/Field'
import { LineItemsEditor } from '../components/invoice/LineItemsEditor'
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

  const erros = useMemo(() => validateDraft(draft), [draft])

  // Erros de linha aparecem assim que o valor e invalido, sem esperar o
  // envio: diferente de campo em branco, um numero negativo ja e erro no
  // momento em que foi digitado.
  const errosDeLinha = useMemo(() => {
    const r: Record<string, string | undefined> = {}
    for (const item of draft.items) Object.assign(r, validateItem(item))
    return r
  }, [draft.items])
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
      // Diz a verdade: o modulo do jsPDF fica cacheado como falho pelo ESM,
      // entao clicar de novo nao vai a rede. So recarregar resolve (INV-05).
      setErroPdf('Could not generate the PDF. Please reload the page and try again.')
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
      }, resta)
    }
  }, [draft, erros])

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Free invoice generator
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
          Create a professional invoice for international clients. No sign-up,
          nothing leaves your browser.
        </p>
      </header>

      {/* fieldset em vez de `disabled` campo a campo: um atributo so cobre
          todos os inputs, inclusive os das linhas, que sao dinamicos.
          `min-w-0` porque fieldset tem largura minima automatica que quebra
          grid. */}
      <fieldset
        disabled={bloqueado}
        className="flex min-w-0 flex-col gap-10 border-0 p-0"
      >
        <section aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-lg font-semibold tracking-tight">
            Invoice details
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              id="invoice-number"
              label="Invoice number"
              value={draft.invoiceNumber}
              onChange={(v) => inv.setCampo('invoiceNumber', v)}
              onBlur={tocar('invoiceNumber')}
              error={erro('invoiceNumber')}
              placeholder="INV-0001"
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
            <SelectField
              id="currency"
              label="Currency"
              value={draft.currency}
              onChange={(v) => {
                if (isCurrencyCode(v)) inv.setCurrency(v)
              }}
              options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
            />
          </div>
        </section>

        <div className="grid gap-10 sm:grid-cols-2">
          <section aria-labelledby="from-heading">
            <h2 id="from-heading" className="text-lg font-semibold tracking-tight">
              From
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <TextField
                id="from-name"
                label="Name or company"
                value={draft.from.name}
                onChange={(v) => inv.setFrom('name', v)}
                onBlur={tocar('from.name')}
                error={erro('from.name')}
                autoComplete="organization"
              />
              <TextAreaField
                id="from-address"
                label="Address"
                value={draft.from.address}
                onChange={(v) => inv.setFrom('address', v)}
                placeholder={'Street, number\nCity, State, ZIP\nCountry'}
              />
              <TextField
                id="from-email"
                label="Email"
                type="email"
                value={draft.from.email}
                onChange={(v) => inv.setFrom('email', v)}
                onBlur={tocar('from.email')}
                error={erro('from.email')}
                autoComplete="email"
              />
              <TextField
                id="from-taxid"
                label="Tax ID"
                value={draft.from.taxId}
                onChange={(v) => inv.setFrom('taxId', v)}
                hint="Optional — CNPJ, VAT, EIN…"
              />
            </div>
          </section>

          <section aria-labelledby="billto-heading">
            <h2 id="billto-heading" className="text-lg font-semibold tracking-tight">
              Bill to
            </h2>
            <div className="mt-4 flex flex-col gap-4">
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
                label="Address"
                value={draft.billTo.address}
                onChange={(v) => inv.setBillTo('address', v)}
                placeholder={'Street, number\nCity, State, ZIP\nCountry'}
              />
              <TextField
                id="billto-email"
                label="Email"
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

        <div
          className="flex items-baseline justify-end gap-4 border-t pt-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-semibold uppercase tracking-wide">
            Total
          </span>
          {/* polite: anuncia o total quando a digitacao assenta, sem
              tagarelar a cada tecla. */}
          <span
            aria-live="polite"
            className="text-2xl font-bold tabular-nums"
            style={{ color: 'var(--brand)' }}
          >
            {formatCents(total, draft.currency)}
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
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
      </fieldset>

      {/* Fora do fieldset: os botoes precisam continuar respondendo para o
          rotulo de progresso aparecer e o Clear seguir alcancavel. */}
      <div className="flex flex-col gap-10">
        <div
          className="mt-10 flex flex-wrap items-center gap-3 border-t pt-6"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Fica habilitado mesmo invalido, validando no clique: botao
              desabilitado nao recebe foco e nao explica por que nada
              acontece.

              Desabilitar durante a geracao e outro caso, nao a excecao dessa
              regra: e bloqueio momentaneo de uma operacao em andamento, com o
              proprio rotulo dizendo o que esta acontecendo — nao recusa
              silenciosa. O aria-busy conta a mesma coisa a quem nao ve o
              rotulo mudar.

              opacity-90, e nao o 40 dos botoes de linha: este botao carrega o
              unico texto de progresso da tela. Apagar o recado que a pessoa
              precisa ler custa contraste (a 0,7 o texto cai para ~3,3:1, sob
              o minimo de AA) sem ganhar nada — a troca de rotulo ja sinaliza
              o bloqueio. */}
          <button
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
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
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

          <p
            role="status"
            aria-live="polite"
            className="text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {estadoPdf === 'pronto'
              ? 'Invoice downloaded.'
              : inv.salvo
                ? 'Draft saved in this browser.'
                : 'Saving…'}
          </p>

          {erroPdf && (
            <p role="alert" className="text-sm" style={{ color: WARN_INK }}>
              {erroPdf}
            </p>
          )}
        </div>
      </div>

      <footer
        className="mt-16 border-t pt-6 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <p>
          Horizons also has free, in-depth System Design study tracks
          (in Portuguese).{' '}
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
    </main>
  )
}
