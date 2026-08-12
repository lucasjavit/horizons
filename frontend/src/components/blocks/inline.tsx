import { Fragment, type ReactNode } from 'react'

/* O conteúdo das aulas usa duas marcações inline: *ênfase* e `código`.
   Não vale trazer um parser de markdown inteiro para isso — a regex cobre
   exatamente o que o seed produz, e texto sem marcação passa intacto. */
const INLINE = /(\*[^*\n]+\*|`[^`\n]+`)/g

export function inline(text: string): ReactNode {
  const partes = text.split(INLINE)
  if (partes.length === 1) return text

  return partes.map((parte, i) => {
    if (parte.startsWith('*') && parte.endsWith('*') && parte.length > 2) {
      return <em key={i}>{parte.slice(1, -1)}</em>
    }
    if (parte.startsWith('`') && parte.endsWith('`') && parte.length > 2) {
      return (
        <code
          key={i}
          className="rounded px-1 py-0.5 font-mono text-[0.875em]"
          style={{ background: 'var(--surface-sunken)' }}
        >
          {parte.slice(1, -1)}
        </code>
      )
    }
    return <Fragment key={i}>{parte}</Fragment>
  })
}
