import { useState } from 'react'
import type { Company } from '../../invoice/companies'
import { emptyCompany } from '../../invoice/companies'
import { TextAreaField, TextField } from './Field'
import { Modal } from './Modal'
import { WARN_INK } from '../blocks/BlockRenderer'

interface CompanyPickerProps {
  companies: Company[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSave: (empresa: Company) => void
  onDelete: (id: string) => void
}

/** Select das empresas salvas + modal de cadastro e edicao. */
export function CompanyPicker({
  companies,
  selectedId,
  onSelect,
  onSave,
  onDelete,
}: CompanyPickerProps) {
  const [editando, setEditando] = useState<Company | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const atual = companies.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="company-select" className="mb-1 block text-sm font-medium">
            Your company
          </label>
          <select
            id="company-select"
            value={selectedId ?? ''}
            onChange={(e) => onSelect(e.target.value || null)}
            className="w-full rounded-md border px-3 py-2.5 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-sunken)',
              color: 'var(--text)',
            }}
          >
            <option value="">
              {companies.length === 0
                ? 'No companies saved yet'
                : 'Select a company…'}
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setEditando(emptyCompany())}
          className="shrink-0 rounded-md border px-3 py-2.5 text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          + Add company
        </button>
      </div>

      {atual && (
        <div
          className="rounded-lg border p-3 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
        >
          <p className="font-medium">{atual.name}</p>
          {atual.address && (
            <p className="mt-0.5 whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
              {atual.address}
            </p>
          )}
          {(atual.email || atual.taxId) && (
            <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {[atual.email, atual.taxId && `Tax ID ${atual.taxId}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditando(atual)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Edit
            </button>

            {!confirmando ? (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Delete
              </button>
            ) : (
              <span role="alert" className="flex flex-wrap items-center gap-2 text-xs">
                Delete {atual.name}?
                <button
                  type="button"
                  onClick={() => {
                    onDelete(atual.id)
                    setConfirmando(false)
                  }}
                  className="rounded-md px-2.5 py-1.5 text-xs font-semibold"
                  style={{ background: WARN_INK, color: '#fff' }}
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="rounded-md border px-2.5 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Keep it
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {editando && (
        <CompanyForm
          empresa={editando}
          onCancel={() => setEditando(null)}
          onSave={(c) => {
            // So o onSave: ele ja grava a empresa E copia para o From. Chamar
            // onSelect aqui procuraria o id na lista anterior, que ainda nao
            // tem a empresa nova, e limparia o From recem-preenchido.
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
    <Modal
      title={empresa.name ? 'Edit company' : 'Add company'}
      onClose={onCancel}
    >
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
