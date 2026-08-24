import { useCallback, useEffect, useRef, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'

/**
 * O controle do canal Telegram, na aba Jobs (JOB-32).
 *
 * Fica ao lado do `AssinaturaEmail` e diz, no texto, que é **adicional** ao
 * e-mail e não em vez dele — critério do card. A decisão de produto é essa: o
 * Telegram não substitui o e-mail, e uma tela que sugerisse escolha entre os
 * dois faria a pessoa desligar um achando que precisava.
 *
 * **Some inteiro quando o canal não está configurado no servidor**
 * (`disponivel: false`). Mostrar um botão que falha no clique é pior que não
 * mostrar botão nenhum.
 */

/**
 * De quanto em quanto tempo se pergunta se o START já aconteceu.
 *
 * O critério do card é que o vínculo apareça **sem a pessoa recarregar a
 * página**, e ela vai estar no app do Telegram quando isso acontecer. Três
 * segundos é rápido o bastante para a volta parecer instantânea e devagar o
 * bastante para não ser uma consulta por segundo — e só roda enquanto há um
 * convite aberto, não o tempo todo.
 */
const INTERVALO_MS = 3000

/** Depois disso o convite do backend já expirou (30 min); parar de perguntar. */
const LIMITE_MS = 30 * 60 * 1000

export function AssinaturaTelegram() {
  const { data, loading, error, setData } = useAsync(
    (signal) => api.telegramStatus(signal),
    [],
  )
  // Erro de mutação num estado separado do erro do `useAsync` — padrão da casa.
  const [erroAcao, setErroAcao] = useState('')
  const [salvando, setSalvando] = useState(false)
  /** Há um convite aberto: a pessoa clicou e foi para o Telegram. */
  const [aguardando, setAguardando] = useState(false)
  const abertoEm = useRef(0)

  const parar = useCallback(() => {
    setAguardando(false)
    abertoEm.current = 0
  }, [])

  // Enquanto aguarda o START, pergunta ao servidor se já vinculou. É isto que
  // faz o estado virar "conectado" sem recarregar a página.
  useEffect(() => {
    if (!aguardando) return

    const timer = window.setInterval(() => {
      if (Date.now() - abertoEm.current > LIMITE_MS) {
        parar()
        setErroAcao('The link expired. Click Connect Telegram to get a new one.')
        return
      }
      api
        .telegramStatus()
        .then((s) => {
          if (s.vinculado) {
            setData(s)
            parar()
          }
        })
        // Uma consulta que falha não derruba o ciclo: a próxima tenta de novo.
        // Rede oscilando não pode transformar "aguardando" em erro.
        .catch(() => {})
    }, INTERVALO_MS)

    return () => window.clearInterval(timer)
  }, [aguardando, parar, setData])

  // Some em silêncio enquanto carrega ou se falhar, igual ao do e-mail: é um
  // controle acessório, e um erro aqui não pode roubar a atenção de quem veio
  // ver vagas.
  if (loading || error || !data) return null
  // **Canal desligado no servidor: a opção não aparece.** Critério do card.
  if (!data.disponivel) return null

  const conectar = async () => {
    setErroAcao('')
    setSalvando(true)
    try {
      const { url } = await api.vincularTelegram()
      abertoEm.current = Date.now()
      setAguardando(true)
      // `noopener` porque a página de destino não é nossa — sem ele ela
      // ganharia acesso a `window.opener`.
      window.open(url, '_blank', 'noopener,noreferrer')
      // **Não libera o botão no sucesso.**
      //
      // Medido pelo QA em 24/08: dois cliques rápidos criavam dois convites, e
      // `criarConvite` apaga os pendentes — então o link da PRIMEIRA aba morria
      // e o `/start` respondia "This link is not valid". Enquanto `aguardando`
      // está de pé, o botão continua fora de ação; só uma falha o devolve.
    } catch (e) {
      setErroAcao(errorMessage(e))
      setSalvando(false)
    }
  }

  const desconectar = async () => {
    setErroAcao('')
    setSalvando(true)
    try {
      setData(await api.desvincularTelegram())
      parar()
    } catch (e) {
      setErroAcao(errorMessage(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section
      aria-labelledby="telegram-titulo"
      className="mt-4 rounded-xl border p-5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="telegram-titulo" className="text-base font-semibold">
        {data.vinculado ? 'Connected to Telegram' : 'Also get jobs on Telegram'}
      </h2>

      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {data.vinculado ? (
          data.ativo ? (
            <>
              The same jobs we email you also arrive on Telegram
              {data.username ? `, as @${data.username}` : ''}. This is in
              addition to email — turning it off here doesn't stop your emails.
            </>
          ) : (
            // O caso do bot bloqueado. Dizer o que houve e o que fazer, em vez
            // de mostrar "conectado" enquanto nada chega.
            <>
              Telegram is connected but we can't deliver — it looks like the bot
              was blocked. Unblock it on Telegram, or disconnect here.
            </>
          )
        ) : (
          <>
            Get the same jobs on Telegram, <strong>in addition to email</strong>{' '}
            — not instead of it. You'll need to press START in the Telegram app
            so the bot can message you.
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {data.vinculado ? (
          <button
            type="button"
            disabled={salvando}
            onClick={() => void desconectar()}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {salvando ? 'Saving…' : 'Disconnect Telegram'}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={salvando || aguardando}
              onClick={() => void conectar()}
              className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
            >
              {salvando ? 'Opening…' : 'Connect Telegram'}
            </button>
            {aguardando && (
              <button
                type="button"
                onClick={parar}
                className="rounded-md border px-4 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>

      {/* `aria-live` porque a mudança chega sozinha, pela varredura: quem usa
          leitor de tela não tem como saber que o estado mudou se ninguém
          anunciar. `polite` para não cortar o que estiver sendo lido. */}
      <p aria-live="polite" className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        {aguardando
          ? 'Waiting for you to press START in Telegram…'
          : ''}
      </p>

      {erroAcao && (
        <p
          role="alert"
          className="mt-1 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: WARN_INK, color: WARN_INK }}
        >
          {erroAcao}
        </p>
      )}
    </section>
  )
}
