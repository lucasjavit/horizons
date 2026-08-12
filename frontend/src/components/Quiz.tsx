import { useState } from 'react'
import { inline } from './blocks/inline'

interface QuizProps {
  questions: { q: string; a: string }[]
}

/** Auto-teste: a resposta fica escondida até o clique — tentar antes é o ponto. */
export function Quiz({ questions }: QuizProps) {
  const [abertas, setAbertas] = useState<Set<number>>(new Set())

  const alternar = (i: number) => {
    setAbertas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(i)) proximo.delete(i)
      else proximo.add(i)
      return proximo
    })
  }

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">Auto-teste</h2>
      <ol className="space-y-3">
        {questions.map((item, i) => {
          const aberta = abertas.has(i)
          return (
            <li
              key={i}
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={() => alternar(i)}
                aria-expanded={aberta}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 font-medium leading-relaxed">
                  {inline(item.q)}
                </span>
                <span
                  className="mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--accent-ink)' }}
                >
                  {aberta ? 'ocultar' : 'ver'}
                </span>
              </button>
              {aberta && (
                <div
                  className="border-t px-4 py-4 pl-[3.25rem] leading-relaxed"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface-sunken)',
                  }}
                >
                  {inline(item.a)}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
