import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { api, errorMessage } from '../lib/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { Assinatura } from '../types/api'

/**
 * Onde os links do e-mail caem — **sem login** (critério do JOB-24 e do
 * JOB-25).
 *
 * Uma página só para as três ações porque elas partilham tudo: a credencial é
 * o token da URL, o resultado é a mesma assinatura, e cada uma tem de oferecer
 * o caminho de volta. Quem descadastrou por engano reassina daqui; quem
 * marcou "consegui a vaga" volta a procurar daqui.
 *
 * **A ação dispara sozinha ao abrir, e é de propósito.** O critério diz "um
 * clique", e o clique já aconteceu no e-mail — pedir um segundo botão aqui
 * seria dois. O que protege contra o pré-carregador de link do cliente de
 * e-mail não é uma tela de confirmação: é o backend só aceitar `POST`.
 */

type Acao = 'sair' | 'contratado'

export function EmailAcaoPage({ acao }: { acao: Acao }) {
  useDocumentTitle(acao === 'sair' ? 'Email preferences' : 'Congratulations!')
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''

  const [assinatura, setAssinatura] = useState<Assinatura | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  /** Erro da ação de desfazer, separado do erro do carregamento inicial. */
  const [erroDesfazer, setErroDesfazer] = useState('')
  const [desfazendo, setDesfazendo] = useState(false)
  const tituloRef = useRef<HTMLHeadingElement>(null)

  // O React 18+ monta duas vezes em desenvolvimento (StrictMode). Sem esta
  // trava a ação sairia duas vezes — inofensivo aqui porque as duas são
  // idempotentes, mas o log do servidor mentiria sobre quantas pessoas
  // clicaram, e essa é justamente a métrica do JOB-25.
  const jaRodou = useRef(false)

  useEffect(() => {
    if (jaRodou.current) return
    jaRodou.current = true

    if (!token) {
      setErro('This link is missing its code. Use the link from your email.')
      setCarregando(false)
      return
    }
    const executar = acao === 'sair' ? api.sairDoEmail : api.marcarContratado
    executar(token)
      .then((a) => setAssinatura(a))
      .catch((e) => setErro(errorMessage(e)))
      .finally(() => setCarregando(false))
  }, [acao, token])

  // O foco vai para o título quando o resultado chega: quem usa leitor de tela
  // precisa ouvir o desfecho, e sem isto o foco fica no início do documento.
  useEffect(() => {
    if (!carregando) tituloRef.current?.focus()
  }, [carregando])

  const desfazer = useCallback(async () => {
    setErroDesfazer('')
    setDesfazendo(true)
    try {
      // A mesma rota serve aos dois desfazeres: ela religa `ativo` E devolve a
      // cadencia semanal, que e o estado "voltei a procurar" nos dois casos.
      setAssinatura(await api.voltarAProcurar(token))
    } catch (e) {
      setErroDesfazer(errorMessage(e))
    } finally {
      setDesfazendo(false)
    }
  }, [token])

  const marcarContratado = useCallback(async () => {
    setErroDesfazer('')
    setDesfazendo(true)
    try {
      setAssinatura(await api.marcarContratado(token))
    } catch (e) {
      setErroDesfazer(errorMessage(e))
    } finally {
      setDesfazendo(false)
    }
  }, [token])

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-xl px-4 py-16">
      {carregando && (
        <p style={{ color: 'var(--text-muted)' }}>One moment…</p>
      )}

      {!carregando && erro && (
        <>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="text-2xl font-semibold"
            style={{ color: 'var(--text)' }}
          >
            We couldn&apos;t do that
          </h1>
          <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
            {erro}
          </p>
          <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            You can always change this from{' '}
            <a href="/config" style={{ color: 'var(--brand)' }}>
              your settings
            </a>{' '}
            after signing in.
          </p>
        </>
      )}

      {!carregando && assinatura && (
        <>
          <h1
            ref={tituloRef}
            tabIndex={-1}
            className="text-2xl font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {textoTitulo(acao, assinatura)}
          </h1>
          <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {textoExplicacao(acao, assinatura)}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {/* O desfazer é sempre um clique — critério do JOB-25. */}
            {assinatura.cadencia === 'mensal' || !assinatura.ativo ? (
              <button
                type="button"
                onClick={() => void desfazer()}
                disabled={desfazendo}
                className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
              >
                {desfazendo ? 'Saving…' : 'I want weekly jobs again'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void marcarContratado()}
                disabled={desfazendo}
                className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
              >
                {desfazendo ? 'Saving…' : 'I got the job 🎉'}
              </button>
            )}
            <a
              href="/vagas"
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Browse jobs
            </a>
          </div>

          {erroDesfazer && (
            <p role="alert" className="mt-3 text-sm" style={{ color: WARN_INK }}>
              {erroDesfazer}
            </p>
          )}
        </>
      )}
    </main>
  )
}

function textoTitulo(acao: Acao, a: Assinatura): string {
  if (!a.ativo) return "You're unsubscribed"
  if (acao === 'contratado' || a.cadencia === 'mensal') {
    return 'Congratulations! 🎉'
  }
  return "You're subscribed again"
}

/**
 * O texto que explica o que mudou.
 *
 * **Diz o que a pessoa passa a receber, e não o que perdeu.** Quem foi
 * contratado não recebe menos: recebe outra coisa (JOB-25). Escrever "você vai
 * receber menos vagas" transformaria o melhor momento da relação numa notícia
 * de downgrade.
 */
function textoExplicacao(acao: Acao, a: Assinatura): string {
  if (!a.ativo) {
    return "We won't email you about jobs anymore. If this was a mistake, you can turn it back on below."
  }
  if (a.cadencia === 'mensal') {
    return 'We switched you to one hand-picked job a month, so you can keep an eye on the market without looking for it. Your invoice tools are on the Invoice tab whenever you need them.'
  }
  return acao === 'sair'
    ? "You're back on the weekly list."
    : "You're back to weekly jobs — good luck with the search."
}
