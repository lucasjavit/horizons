import { useRef, useState } from 'react'
import type { Company } from '../../invoice/companies'
import { emptyCompany } from '../../invoice/companies'
import type { Issuer } from '../../invoice/types'
import { lerLogo } from '../../invoice/logo'
import { TextAreaField, TextField } from './Field'
import { Modal } from './Modal'
import { WARN_INK } from '../blocks/BlockRenderer'

interface IssuerFieldsProps {
  from: Issuer
  companies: Company[]
  selectedId: string | null
  erroNome?: string
  erroEmail?: string
  onChangeCampo: (campo: keyof Issuer, valor: string) => void
  onSelect: (id: string | null) => void
  onSave: (empresa: Company) => void
  onDelete: (id: string) => void
}

/**
 * Dados do emissor, digitados direto na pagina.
 *
 * O CompanyPicker (INV-08) escondia estes quatro campos num modal, e isso
 * custou duas coisas medidas no INV-09: a coluna esquerda ficou com 108px
 * contra 349px da direita (o buraco de 241px), e o primeiro contato de quem
 * chega do Google virou um pedido de cadastro — justamente num produto cuja
 * vantagem e nao precisar de cadastro.
 *
 * Agora os campos vivem na pagina e a empresa salva e atalho, nao porta.
 */
export function IssuerFields({
  from,
  companies,
  selectedId,
  erroNome,
  erroEmail,
  onChangeCampo,
  onSelect,
  onSave,
  onDelete,
}: IssuerFieldsProps) {
  const [editando, setEditando] = useState<Company | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const atual = companies.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* Atalho, e nao porta de entrada: so aparece quando ja existe empresa
          salva. Quem chega pela primeira vez ve os campos, nao um convite a
          cadastrar. */}
      {companies.length > 0 && (
        <div>
          <label
            htmlFor="company-select"
            className="mb-1 block text-sm font-medium"
          >
            Use a saved company
          </label>
          <div className="flex items-center gap-2">
            <select
              id="company-select"
              value={selectedId ?? ''}
              onChange={(e) => onSelect(e.target.value || null)}
              className="min-w-0 flex-1 rounded-md border px-3 py-2.5 text-sm"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-sunken)',
                color: 'var(--text)',
              }}
            >
              <option value="">Select…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {atual && (
              <>
                <button
                  type="button"
                  onClick={() => setEditando(atual)}
                  className="shrink-0 rounded-md border px-3 py-2.5 text-sm font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  Edit
                </button>
                {!confirmando ? (
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    className="shrink-0 rounded-md border px-3 py-2.5 text-sm font-medium"
                    style={{
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <span
                    role="alert"
                    className="flex shrink-0 items-center gap-1.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(atual.id)
                        setConfirmando(false)
                      }}
                      className="rounded-md px-2.5 py-2 text-xs font-semibold"
                      style={{ background: WARN_INK, color: '#fff' }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(false)}
                      className="rounded-md border px-2.5 py-2 text-xs font-medium"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Keep
                    </button>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <TextField
        id="from-name"
        label="Your name or company"
        value={from.name}
        onChange={(v) => onChangeCampo('name', v)}
        error={erroNome}
        autoComplete="organization"
      />
      <TextAreaField
        id="from-address"
        label="Your address"
        value={from.address}
        onChange={(v) => onChangeCampo('address', v)}
        placeholder={'Street, number\nCity, State, ZIP\nCountry'}
      />
      <TextField
        id="from-email"
        label="Your email"
        type="email"
        value={from.email}
        onChange={(v) => onChangeCampo('email', v)}
        error={erroEmail}
        autoComplete="email"
      />
      <TextField
        id="from-taxid"
        label="Tax ID"
        value={from.taxId}
        onChange={(v) => onChangeCampo('taxId', v)}
        hint="Optional — CNPJ, VAT, EIN…"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditando({ ...emptyCompany(), ...from })}
          className="rounded-md border px-3 py-2 text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Save this company for next time
        </button>
        {companies.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Stays in this browser.
          </span>
        )}
      </div>

      {editando && (
        <CompanyForm
          empresa={editando}
          onCancel={() => setEditando(null)}
          onSave={(c) => {
            onSave(c)
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

function CompanyForm({
  empresa,
  onSave,
  onCancel,
}: {
  empresa: Company
  onSave: (c: Company) => void
  onCancel: () => void
}) {
  const [rascunho, setRascunho] = useState(empresa)
  const [erro, setErro] = useState<string | undefined>()
  const [erroLogo, setErroLogo] = useState<string | undefined>()
  const [cinza, setCinza] = useState(false)
  const arquivoRef = useRef<HTMLInputElement>(null)

  const carregarLogo = async (arquivo: File | undefined, emCinza: boolean) => {
    if (!arquivo) return
    setErroLogo(undefined)
    try {
      const lida = await lerLogo(arquivo, emCinza)
      setRascunho((r) => ({ ...r, logo: lida.dataUri }))
    } catch (e) {
      setErroLogo(e instanceof Error ? e.message : 'Could not read the image.')
    }
  }

  const campo = (k: keyof Company) => (v: string) =>
    setRascunho((r) => ({ ...r, [k]: v }))

  const salvar = () => {
    if (!rascunho.name.trim()) {
      setErro('Company name is required.')
      document.getElementById('company-name')?.focus()
      return
    }
    if (rascunho.email.trim() && !/^\S+@\S+\.\S+$/.test(rascunho.email.trim())) {
      setErro('Enter a valid email address.')
      document.getElementById('company-email')?.focus()
      return
    }
    onSave({ ...rascunho, name: rascunho.name.trim() })
  }

  return (
    <Modal title="Save company" onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <TextField
          id="company-name"
          label="Name"
          value={rascunho.name}
          onChange={campo('name')}
          error={erro?.includes('name') ? erro : undefined}
          autoComplete="organization"
        />
        <TextAreaField
          id="company-address"
          label="Address"
          value={rascunho.address}
          onChange={campo('address')}
          placeholder={'Street, number\nCity, State, ZIP\nCountry'}
        />
        <TextField
          id="company-email"
          label="Email"
          type="email"
          value={rascunho.email}
          onChange={campo('email')}
          error={erro?.includes('email') ? erro : undefined}
          autoComplete="email"
        />
        <TextField
          id="company-taxid"
          label="Tax ID"
          value={rascunho.taxId}
          onChange={campo('taxId')}
          hint="Optional — CNPJ, VAT, EIN…"
        />

        <div>
          <label htmlFor="company-logo" className="mb-1 block text-sm font-medium">
            Logo
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {rascunho.logo && (
              <img
                src={rascunho.logo}
                alt="Your company logo"
                className="h-12 w-auto max-w-[8rem] rounded border object-contain p-1"
                style={{ borderColor: 'var(--border)', background: '#fff' }}
              />
            )}
            <input
              ref={arquivoRef}
              id="company-logo"
              type="file"
              accept="image/*"
              onChange={(e) => void carregarLogo(e.target.files?.[0], cinza)}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            />
            {rascunho.logo && (
              <button
                type="button"
                onClick={() => {
                  setRascunho((r) => ({ ...r, logo: undefined }))
                  if (arquivoRef.current) arquivoRef.current.value = ''
                }}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Remove
              </button>
            )}
          </div>

          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cinza}
              onChange={(e) => {
                setCinza(e.target.checked)
                // Reprocessa o arquivo escolhido: converter a partir da logo
                // ja guardada perderia qualidade a cada troca.
                void carregarLogo(arquivoRef.current?.files?.[0], e.target.checked)
              }}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            <span style={{ color: 'var(--text-muted)' }}>
              Black and white
            </span>
          </label>

          {erroLogo && (
            <p role="alert" className="mt-1 text-sm" style={{ color: WARN_INK }}>
              {erroLogo}
            </p>
          )}
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Optional — replaces the word "INVOICE" on the document. PNG with
            transparency works best. Max 2 MB.
          </p>
        </div>

        <div className="mt-1 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={salvar}
            className="rounded-md px-5 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            Save company
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2.5 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
