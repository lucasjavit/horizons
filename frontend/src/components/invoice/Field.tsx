import type { ReactNode } from 'react'
import { WARN_INK } from '../blocks/BlockRenderer'

/**
 * Campos locais da invoice.
 *
 * Deliberadamente escopados a esta feature, e nao um design system global:
 * sao ~15 campos, e repetir a fiacao de label + erro + aria-describedby
 * quinze vezes garante um bug de acessibilidade. Inventar componentes
 * globais aqui seria uma afirmacao de arquitetura maior do que esta feature
 * justifica.
 */

const estiloBase = 'w-full rounded-md border px-3 py-2.5 text-sm'

function estiloCampo(erro?: string) {
  return {
    borderColor: erro ? WARN_INK : 'var(--border)',
    background: 'var(--surface-sunken)',
    color: 'var(--text)',
  }
}

interface BaseProps {
  id: string
  label: string
  error?: string
  hint?: string
}

function Envelope({
  id,
  label,
  error,
  hint,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p
          id={`${id}-hint`}
          className="mt-1 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-sm"
          style={{ color: WARN_INK }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

/** aponta para a mensagem so quando ela existe: describedby apontando para
 *  elemento ausente e tratado de forma inconsistente pelos leitores. */
function descritoPor(id: string, erro?: string, hint?: string) {
  if (erro) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

interface TextFieldProps extends BaseProps {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  type?: 'text' | 'email' | 'date'
  placeholder?: string
  inputMode?: 'text' | 'decimal'
  autoComplete?: string
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  type = 'text',
  placeholder,
  inputMode,
  autoComplete,
}: TextFieldProps) {
  return (
    <Envelope id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, error, hint)}
        className={estiloBase}
        style={estiloCampo(error)}
      />
    </Envelope>
  )
}

interface TextAreaFieldProps extends BaseProps {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  rows?: number
  placeholder?: string
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  rows = 3,
  placeholder,
}: TextAreaFieldProps) {
  return (
    <Envelope id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, error, hint)}
        className={`${estiloBase} resize-y leading-relaxed`}
        style={estiloCampo(error)}
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
}: SelectFieldProps) {
  return (
    <Envelope id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, error, hint)}
        className={estiloBase}
        style={estiloCampo(error)}
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
