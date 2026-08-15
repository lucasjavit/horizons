import type { ReactNode } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'
import { SeloOrigem } from './SeloOrigem'

/**
 * Campos locais da tela de vagas.
 *
 * Copiado de `components/invoice/Field.tsx` e adaptado, **não** promovido a
 * componente global — JOB-04 tomou a mesma decisão, e as duas telas devem
 * seguir o mesmo caminho para não divergirem. Duas diferenças em relação ao
 * original da invoice, ambas exigidas pelo desenho:
 *
 * - o `Envelope` aceita um **adorno à direita do rótulo** (o selo "do
 *   currículo");
 * - o `aria-describedby` compõe **mais de um id** — selo, dica e erro podem
 *   coexistir, e o original só sabia apontar para um.
 */

const estiloBase = 'w-full rounded-md border px-3 py-2.5 text-sm'

export function estiloCampo(erro?: string, doCv?: boolean) {
  return {
    borderColor: erro ? WARN_INK : 'var(--border)',
    background: 'var(--surface-sunken)',
    color: 'var(--text)',
    // Borda esquerda de 3px: forma, não cor. Aparece mesmo em monocromático,
    // que é o ponto — cor sozinha não sinaliza nada no projeto.
    ...(doCv && !erro
      ? { borderLeftWidth: '3px', borderLeftColor: 'var(--accent-ink)' }
      : {}),
  }
}

export interface BaseProps {
  id: string
  label: string
  error?: string
  hint?: string
  /** Preenchido pela leitura do CV e ainda não editado pela pessoa. */
  doCv?: boolean
}

/**
 * Monta o `aria-describedby` a partir dos ids que existem de fato.
 *
 * Apontar para um elemento ausente é tratado de forma inconsistente pelos
 * leitores de tela, então só entra na lista o que está na tela. A ordem
 * importa: o erro vem primeiro porque é o que a pessoa precisa ouvir antes.
 */
export function descritoPor(id: string, erro?: string, hint?: string, doCv?: boolean) {
  const ids = [
    erro ? `${id}-error` : null,
    hint && !erro ? `${id}-hint` : null,
    doCv ? `${id}-selo` : null,
  ].filter(Boolean)
  return ids.length > 0 ? ids.join(' ') : undefined
}

export function Envelope({
  id,
  label,
  error,
  hint,
  doCv,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div>
      {/* flex-wrap: no celular o selo desce para baixo do rótulo em vez de
          espremê-lo, como o desenho pede. */}
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {doCv && <SeloOrigem id={`${id}-selo`} />}
      </div>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      {doCv && !error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Veio do currículo. Editar substitui pelo que você escrever.
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm" style={{ color: WARN_INK }}>
          {error}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends BaseProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  doCv,
  placeholder,
  inputMode,
}: TextFieldProps) {
  return (
    <Envelope id={id} label={label} error={error} hint={hint} doCv={doCv}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, error, hint, doCv)}
        className={estiloBase}
        style={estiloCampo(error, doCv)}
      />
    </Envelope>
  )
}

interface SelectFieldProps extends BaseProps {
  value: string
  onChange: (v: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  doCv,
}: SelectFieldProps) {
  return (
    <Envelope id={id} label={label} error={error} hint={hint} doCv={doCv}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, error, hint, doCv)}
        className={estiloBase}
        style={estiloCampo(error, doCv)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Envelope>
  )
}
