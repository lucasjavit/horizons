import type { Block } from '../../types/api'
import { inline } from './inline'

/* Um componente por tipo de bloco. Cada um cuida do próprio estilo, sempre
   via tokens semânticos — o tema escuro depende disso. */

function Paragraph({ text }: { text: string }) {
  return <p className="leading-[1.75] text-[1.0625rem]">{inline(text)}</p>
}

function Heading({ text }: { text: string }) {
  return (
    <h2 className="mt-10 mb-1 text-xl font-semibold tracking-tight">{text}</h2>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span
            className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--accent)' }}
            aria-hidden
          />
          <span>{inline(item)}</span>
        </li>
      ))}
    </ul>
  )
}

function Code({ code, lang }: { code: string; lang?: string }) {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border)' }}
    >
      {lang && (
        <div
          className="border-b px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text-muted)',
          }}
        >
          {lang}
        </div>
      )}
      <pre
        className="overflow-x-auto p-4 text-[0.8125rem] leading-relaxed"
        style={{ background: 'var(--surface-sunken)' }}
      >
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}

/** Ideia central — destaque em dourado, o acento da marca. */
function KeyIdea({ text }: { text: string }) {
  return (
    <aside
      className="rounded-r-lg border-l-4 py-4 pl-5 pr-4"
      style={{
        borderColor: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))',
      }}
    >
      <p
        className="mb-1 text-[0.7rem] font-bold uppercase tracking-widest"
        style={{ color: 'var(--accent-ink)' }}
      >
        Ideia central
      </p>
      <p className="font-medium leading-relaxed">{inline(text)}</p>
    </aside>
  )
}

/* Alerta: âmbar-avermelhado, escolhido para não competir com o dourado da
   marca nem se confundir com ele. */
/* O tom claro é #A34A17 e não #B4531A: sobre o fundo do bloco, aquele media
   4,42:1 e reprova em WCAG AA. Este mede 5,22:1. O tom escuro já passa. */
const WARN = '#A34A17'
const WARN_DARK = '#E8894A'

/** Cor de alerta pronta para uso fora do renderizador (avisos, erros). */
export const WARN_INK = `light-dark(${WARN}, ${WARN_DARK})`

function Warning({ title, text }: { title?: string; text: string }) {
  return (
    <aside
      className="rounded-r-lg border-l-4 py-4 pl-5 pr-4"
      style={{
        borderColor: WARN,
        background: `color-mix(in srgb, ${WARN} 9%, var(--surface))`,
      }}
    >
      <p
        className="mb-1 text-[0.7rem] font-bold uppercase tracking-widest"
        style={{ color: `light-dark(${WARN}, ${WARN_DARK})` }}
      >
        {title ?? 'Atenção'}
      </p>
      <p className="leading-relaxed">{inline(text)}</p>
    </aside>
  )
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div
      className="overflow-x-auto rounded-lg border"
      style={{ borderColor: 'var(--border)' }}
    >
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-sunken)' }}>
            {head.map((cell, i) => (
              <th
                key={i}
                scope="col"
                className="border-b px-4 py-2.5 text-left font-semibold"
                style={{ borderColor: 'var(--border)' }}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  className="border-b px-4 py-2.5 align-top leading-snug"
                  style={{
                    borderColor: 'var(--border)',
                    color: c === 0 ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: c === 0 ? 500 : 400,
                  }}
                >
                  {inline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderBlock(block: Block, index: number) {
  switch (block.type) {
    case 'p':
      return <Paragraph key={index} text={block.text} />
    case 'h':
      return <Heading key={index} text={block.text} />
    case 'list':
      return <List key={index} items={block.items} />
    case 'code':
      return <Code key={index} code={block.code} lang={block.lang} />
    case 'key':
      return <KeyIdea key={index} text={block.text} />
    case 'warn':
      return <Warning key={index} title={block.title} text={block.text} />
    case 'table':
      return <Table key={index} head={block.head} rows={block.rows} />
  }
}

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return <div className="space-y-5">{blocks.map(renderBlock)}</div>
}
