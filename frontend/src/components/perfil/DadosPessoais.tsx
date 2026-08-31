import { useEffect, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import type { PerfilPessoal } from '../../types/api'

type Estado = 'ocioso' | 'salvando' | 'salvo' | 'erro'

/**
 * A segunda seção do perfil: o que é **nosso**, e por isso editável (PLT-10).
 *
 * A primeira seção mostra o que vem do Google e não se edita aqui. A distinção
 * precisa ficar visível, senão a página inteira parece um formulário e a
 * pessoa tenta trocar o nome.
 *
 * **Os três campos são opcionais.** Um perfil vazio é um perfil válido: o
 * produto deixa ler as trilhas sem login, e um formulário obrigatório depois
 * do login inverteria isso. Nada aqui bloqueia quem não quer preencher.
 */
export function DadosPessoais() {
  const { data, loading, error, reload } = useAsync(
    (s) => Promise.all([api.meuPerfil(s), api.paises(s)]),
    [],
  )

  const [pais, setPais] = useState('')
  const [telefone, setTelefone] = useState('')
  const [documento, setDocumento] = useState('')
  // O que o servidor tem guardado. Só os últimos dígitos chegam aqui — o
  // documento em si nunca volta.
  const [guardado, setGuardado] = useState<PerfilPessoal | null>(null)

  // Erro de mutação num estado separado do erro do `useAsync`: a página
  // carregou, o que falhou foi o clique em Save.
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erroAcao, setErroAcao] = useState('')
  const [erroCampo, setErroCampo] = useState('')

  useEffect(() => {
    if (!data) return
    const [perfil] = data
    setGuardado(perfil)
    setPais(perfil.country ?? '')
    setTelefone(perfil.phone ?? '')
  }, [data])

  if (loading) return null
  if (error || !data) {
    return (
      <section className="mt-8">
        <p
          role="alert"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: WARN_INK, color: WARN_INK }}
        >
          Could not load your details.{' '}
          <button
            type="button"
            onClick={reload}
            className="underline"
            style={{ color: WARN_INK }}
          >
            Try again
          </button>
        </p>
      </section>
    )
  }

  const [, paises] = data
  const escolhido = paises.find((p) => p.codigo === pais)

  // O documento guardado foi validado contra OUTRO país: não vale mais.
  // Mostrar "Saved" aqui seria mentir, e é exatamente o silêncio que o card
  // existe para impedir.
  const guardadoObsoleto =
    !!guardado?.documentHint &&
    !!guardado.documentCountry &&
    !!pais &&
    guardado.documentCountry !== pais

  const rotuloDoc = escolhido ? escolhido.documento : 'Document'

  const salvar = async () => {
    setErroAcao('')
    setErroCampo('')
    setEstado('salvando')
    try {
      const salvo = await api.salvarPerfil({
        country: pais,
        phone: telefone,
        // Só manda o documento se a pessoa digitou algo agora. Mandar `''`
        // apagaria o que está guardado a cada Save de telefone.
        ...(documento.trim() ? { document: documento } : {}),
      })
      setGuardado(salvo)
      // O campo esvazia depois de salvar: o valor não volta do servidor, e
      // deixá-lo preenchido daria a impressão de que a tela o leu de lá.
      setDocumento('')
      setEstado('salvo')
    } catch (e) {
      const msg = errorMessage(e)
      // 400 é erro de validação do documento — mora ao lado do campo, com
      // borda e `aria-invalid`. Os outros são falha de rede ou de servidor, e
      // vão para o alerta geral.
      const status =
        typeof e === 'object' && e && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined
      if (status === 400) setErroCampo(msg)
      else setErroAcao(msg)
      setEstado('erro')
      // ⚠️ Nada é limpo aqui. Falha de rede não pode perder o que foi
      // digitado: a pessoa corrige a conexão e clica Save de novo.
    }
  }

  const bordaDoc = erroCampo ? WARN_INK : 'var(--border)'

  return (
    <section aria-labelledby="dados-titulo" className="mt-10">
      <h2 id="dados-titulo" className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        Your details
      </h2>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        All optional — fill in what you want, when you want. We only need these
        to invoice you if you ever buy something.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <label
            htmlFor="perfil-pais"
            className="block text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            Where you live
          </label>
          <select
            id="perfil-pais"
            value={pais}
            onChange={(e) => {
              setPais(e.target.value)
              // Trocar de país revalida: o que estava digitado foi pensado
              // para outra regra, e o erro anterior não vale mais.
              setDocumento('')
              setErroCampo('')
              setEstado('ocioso')
            }}
            className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            <option value="">Not set</option>
            {paises.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="perfil-telefone"
            className="block text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            Phone
          </label>
          <input
            id="perfil-telefone"
            type="tel"
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder={escolhido?.ddi ? `+${escolhido.ddi} 11 91234 5678` : '+55 11 91234 5678'}
            className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Include the country code.
          </p>
        </div>

        <div>
          <label
            htmlFor="perfil-documento"
            className="block text-sm font-medium"
            style={{ color: 'var(--text)' }}
          >
            {rotuloDoc}
          </label>
          <input
            id="perfil-documento"
            type="text"
            value={documento}
            onChange={(e) => {
              setDocumento(e.target.value)
              setErroCampo('')
            }}
            disabled={!pais}
            aria-invalid={erroCampo ? true : undefined}
            aria-describedby="perfil-documento-ajuda"
            placeholder={
              pais ? (escolhido?.exemplo ?? '') : 'Pick a country first'
            }
            className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              borderColor: bordaDoc,
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <p id="perfil-documento-ajuda" className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {!pais ? (
              'Pick a country and we will ask for the right document.'
            ) : guardadoObsoleto ? (
              // O caso que o card nomeia: país trocado, documento antigo não
              // serve mais. A tela diz isso em vez de aceitar em silêncio.
              <>
                You changed country, so your saved document no longer applies.
                Enter your {rotuloDoc} to replace it.
              </>
            ) : guardado?.documentHint ? (
              <>Saved — ends in {guardado.documentHint}. Type a new one to replace it.</>
            ) : escolhido?.validado ? (
              <>We check this against the {escolhido.nome} format.</>
            ) : (
              'Whatever ID your country uses for invoices.'
            )}
          </p>
          {erroCampo && (
            // Erro por borda + aria-invalid + texto. Nunca só cor.
            <p role="alert" className="mt-1.5 text-sm" style={{ color: WARN_INK }}>
              {erroCampo}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={estado === 'salvando'}
          className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          {estado === 'salvando' ? 'Saving…' : 'Save details'}
        </button>
        {/* `aria-live` para quem não vê a mudança de rótulo do botão. */}
        <p aria-live="polite" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {estado === 'salvo' ? 'Saved.' : ''}
        </p>
      </div>

      {erroAcao && (
        <p
          role="alert"
          className="mt-3 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: WARN_INK, color: WARN_INK }}
        >
          {erroAcao} Nothing was lost — try Save again.
        </p>
      )}
    </section>
  )
}
