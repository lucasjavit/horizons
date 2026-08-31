import { useEffect, useState } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { api, errorMessage } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import type { EnderecoAEnviar, PerfilPessoal } from '../../types/api'

/** O endereço no formulário: string em todo campo, porque input controlado. */
type FormEndereco = Record<keyof EnderecoAEnviar, string>

const ENDERECO_VAZIO: FormEndereco = {
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
}

type Estado = 'ocioso' | 'salvando' | 'salvo' | 'erro'

/**
 * Um campo de texto do endereço.
 *
 * Existe porque são sete campos com a MESMA estrutura — label, input, tokens
 * de cor. Sete cópias divergem: a próxima pessoa conserta a borda de um e não
 * dos outros seis, e o `htmlFor` é o primeiro a se perder num copy-paste.
 */
function CampoDeEndereco({
  id,
  rotulo,
  valor,
  aoMudar,
  exemplo,
  autoComplete,
  className,
}: {
  id: string
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  exemplo?: string
  autoComplete?: string
  className?: string
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium"
        style={{ color: 'var(--text)' }}
      >
        {rotulo}
      </label>
      <input
        id={id}
        type="text"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={exemplo}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
        }}
      />
    </div>
  )
}

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
  const [endereco, setEndereco] = useState<FormEndereco>(ENDERECO_VAZIO)
  // O que o servidor tem guardado. Só os últimos dígitos chegam aqui — o
  // documento em si nunca volta.
  const [guardado, setGuardado] = useState<PerfilPessoal | null>(null)

  // Erro de mutação num estado separado do erro do `useAsync`: a página
  // carregou, o que falhou foi o clique em Save.
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erroAcao, setErroAcao] = useState('')
  const [erroCampo, setErroCampo] = useState('')
  // O 400 do endereço é erro de campo, mas de OUTRO campo: pendurá-lo no
  // documento poria `aria-invalid` no input errado e mandaria a pessoa
  // corrigir o CPF por causa de uma vírgula na rua.
  const [erroEndereco, setErroEndereco] = useState('')

  useEffect(() => {
    if (!data) return
    const [perfil] = data
    setGuardado(perfil)
    setPais(perfil.country ?? '')
    setTelefone(perfil.phone ?? '')
    // O endereço volta inteiro do servidor (não é cifrado como o documento),
    // então a pessoa edita em cima do que já está lá.
    setEndereco({
      street: perfil.address.street ?? '',
      number: perfil.address.number ?? '',
      complement: perfil.address.complement ?? '',
      district: perfil.address.district ?? '',
      city: perfil.address.city ?? '',
      state: perfil.address.state ?? '',
      postalCode: perfil.address.postalCode ?? '',
      country: perfil.address.country ?? '',
    })
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
    setErroEndereco('')
    setEstado('salvando')
    try {
      const salvo = await api.salvarPerfil({
        country: pais,
        phone: telefone,
        // Só manda o documento se a pessoa digitou algo agora. Mandar `''`
        // apagaria o que está guardado a cada Save de telefone.
        ...(documento.trim() ? { document: documento } : {}),
        // O endereço vai SEMPRE e inteiro, ao contrário do documento: os
        // campos estão todos na tela com o valor atual, então mandar `''` é o
        // gesto de apagar de quem esvaziou um campo — não uma perda acidental.
        address: endereco,
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
      // O backend valida documento e endereço no mesmo `PUT` e devolve 400
      // para os dois. A mensagem do endereço começa pelo rótulo do campo
      // ("Street is too long", "Postal code must be…"), e é o que separa os
      // dois destinos — não há código de erro por campo na resposta.
      if (status === 400 && /^(Street|Number|Complement|District|City|State|Postal code)\b/.test(msg)) {
        setErroEndereco(msg)
      } else if (status === 400) setErroCampo(msg)
      else setErroAcao(msg)
      setEstado('erro')
      // ⚠️ Nada é limpo aqui. Falha de rede não pode perder o que foi
      // digitado: a pessoa corrige a conexão e clica Save de novo.
    }
  }

  // Digitar limpa o erro do servidor: ele se referia ao valor antigo, e
  // mantê-lo enquanto a pessoa corrige diz que a correção não adiantou.
  const mudarEndereco = (campo: keyof FormEndereco, valor: string) => {
    setEndereco((atual) => ({ ...atual, [campo]: valor }))
    setErroEndereco('')
    setEstado('ocioso')
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

      {/*
        O endereço é um `fieldset` com legend, e não mais sete campos soltos
        no meio dos outros três. São duas razões:

        1. **Leitor de tela.** O `fieldset` faz "City" ser anunciado como
           "Billing address, City" — sem ele, sete rótulos genéricos flutuam
           sem dizer a que grupo pertencem.
        2. **Olho.** A seção tinha 3 campos e passou a ter 11. O subtítulo
           separa "quem é você" de "para onde vai a nota", e sem ele a página
           vira um formulário longo e indistinto — o que apagaria a distinção
           entre o que vem do Google e o que é nosso, que é o ponto do PLT-10.

        Os campos curtos (número, CEP) dividem linha com o vizinho a partir de
        `sm`: em 390px tudo empilha, porque um campo de 40% de largura numa
        tela estreita não cabe o conteúdo.
      */}
      <fieldset className="mt-8 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
        <legend className="sr-only">Billing address</legend>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Billing address
        </h3>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Also optional. This is where an invoice would be addressed — it can be
          a different country from where you live.
        </p>

        <div className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
            <CampoDeEndereco
              id="perfil-end-rua"
              rotulo="Street"
              valor={endereco.street}
              aoMudar={(v) => mudarEndereco('street', v)}
              exemplo="Avenida Paulista"
              autoComplete="address-line1"
            />
            <CampoDeEndereco
              id="perfil-end-numero"
              rotulo="Number"
              valor={endereco.number}
              aoMudar={(v) => mudarEndereco('number', v)}
              exemplo="1578"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <CampoDeEndereco
              id="perfil-end-complemento"
              rotulo="Complement"
              valor={endereco.complement}
              aoMudar={(v) => mudarEndereco('complement', v)}
              exemplo="Apt 42"
              autoComplete="address-line2"
            />
            <CampoDeEndereco
              id="perfil-end-bairro"
              rotulo="District"
              valor={endereco.district}
              aoMudar={(v) => mudarEndereco('district', v)}
              exemplo="Bela Vista"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_1fr_150px]">
            <CampoDeEndereco
              id="perfil-end-cidade"
              rotulo="City"
              valor={endereco.city}
              aoMudar={(v) => mudarEndereco('city', v)}
              exemplo="São Paulo"
              autoComplete="address-level2"
            />
            <CampoDeEndereco
              id="perfil-end-estado"
              rotulo="State or province"
              valor={endereco.state}
              aoMudar={(v) => mudarEndereco('state', v)}
              exemplo="SP"
              autoComplete="address-level1"
            />
            <CampoDeEndereco
              id="perfil-end-cep"
              rotulo="Postal code"
              valor={endereco.postalCode}
              aoMudar={(v) => mudarEndereco('postalCode', v)}
              exemplo="01310-100"
              autoComplete="postal-code"
            />
          </div>

          <div>
            <label
              htmlFor="perfil-end-pais"
              className="block text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              Country
            </label>
            <select
              id="perfil-end-pais"
              value={endereco.country}
              onChange={(e) => mudarEndereco('country', e.target.value)}
              autoComplete="country"
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
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Where the invoice goes — not necessarily where you live.
            </p>
          </div>

          {erroEndereco && (
            // Erro do endereço mora no endereço. A borda vermelha não vai num
            // campo específico porque o servidor diz qual rótulo falhou no
            // texto, e adivinhar o input erraria em metade dos casos.
            <p
              role="alert"
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: WARN_INK, color: WARN_INK }}
            >
              {erroEndereco}
            </p>
          )}
        </div>
      </fieldset>

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
