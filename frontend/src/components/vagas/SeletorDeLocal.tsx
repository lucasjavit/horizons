import { usePopover } from '../../lib/usePopover'

/**
 * O seletor "Location & format" da barra de busca.
 *
 * Botão com globo à esquerda do campo de texto; abre um popover com os dois
 * eixos que mais mudam o resultado: **como** se trabalha e **de onde**.
 *
 * Por que estes dois na frente, e não dentro do modal de filtros: são a
 * pergunta que todo mundo faz primeiro ("remoto na LATAM"), e enterrá-los
 * atrás de "All filters" custaria dois cliques para o caso comum. O modal
 * continua com eles — aqui é atalho, não duplicata: os dois escrevem nos
 * MESMOS campos (`work_modes`, `regions`), então marcar aqui aparece marcado
 * lá.
 */

/** Os formatos, no vocabulário da faceta `work_mode`. */
const FORMATOS: Array<{ valor: string; rotulo: string }> = [
  { valor: 'remote', rotulo: 'Remote' },
  { valor: 'hybrid', rotulo: 'Hybrid' },
  { valor: 'onsite', rotulo: 'On-site' },
]

/**
 * As regiões, na ordem da referência.
 *
 * Os valores são os canônicos da faceta `regions` — `global`, `north_america`,
 * `latam`… Escrevê-los errado não daria erro: a API **ignora em silêncio** o
 * que não reconhece e devolve o catálogo inteiro parecendo resultado bom
 * (JOB-39). Cada um destes foi conferido contra `/api/v1/jobs/facets`.
 */
const REGIOES: Array<{ valor: string; rotulo: string }> = [
  { valor: 'global', rotulo: 'Worldwide' },
  { valor: 'north_america', rotulo: 'North America' },
  { valor: 'latam', rotulo: 'LATAM' },
  { valor: 'eu', rotulo: 'Europe' },
  { valor: 'uk', rotulo: 'UK' },
  { valor: 'mena', rotulo: 'MENA' },
  { valor: 'africa', rotulo: 'Africa' },
  { valor: 'apac', rotulo: 'APAC' },
  { valor: 'cis', rotulo: 'CIS' },
]

export function SeletorDeLocal({
  formatos,
  regioes,
  onMudar,
}: {
  formatos: string[]
  regioes: string[]
  onMudar: (formatos: string[], regioes: string[]) => void
}) {
  // Fecha ao clicar fora e no Esc, devolvendo o foco ao botão — o popover não
  // prende o foco de propósito: quem der Tab sai dele para o campo de busca,
  // que é o próximo passo natural de quem acabou de escolher a região.
  const { aberto, alternar, caixa, gatilho } = usePopover()

  const alternarEm = (lista: string[], valor: string): string[] =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]

  const marcados = formatos.length + regioes.length

  return (
    <div ref={caixa} className="relative">
      <button
        ref={gatilho}
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
        style={{ color: 'var(--text)' }}
      >
        <GlobeIcon />
        <span>Location</span>
        {/* O contador substitui o "+1" da referência: ali é um código de
            telefone, aqui é quantos filtros de lugar estão ligados — o número
            só significa algo se contar o que a pessoa escolheu. */}
        {marcados > 0 && (
          <span
            className="rounded-full px-1.5 text-xs tabular-nums"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {marcados}
          </span>
        )}
        <span aria-hidden className="text-xs">
          ⌄
        </span>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Location and format"
          className="absolute left-0 top-full z-30 mt-2 w-80 rounded-xl border p-4 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <p className="mb-3 text-sm font-semibold">Location &amp; format</p>

          <fieldset className="mb-4">
            <legend className="mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Work format
            </legend>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map((f) => (
                <Pilula
                  key={f.valor}
                  rotulo={f.rotulo}
                  marcado={formatos.includes(f.valor)}
                  onClique={() => onMudar(alternarEm(formatos, f.valor), regioes)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Region
            </legend>
            <div className="flex flex-wrap gap-2">
              {REGIOES.map((r) => (
                <Pilula
                  key={r.valor}
                  rotulo={r.rotulo}
                  marcado={regioes.includes(r.valor)}
                  onClique={() => onMudar(formatos, alternarEm(regioes, r.valor))}
                />
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}

/**
 * Uma pílula de seleção.
 *
 * `aria-pressed` serve aqui, ao contrário do chip do modal: são **dois**
 * estados, e "pressionado" descreve exatamente o marcado. E o estado não vai
 * só na cor — a borda muda de espessura junto.
 */
function Pilula({
  rotulo,
  marcado,
  onClique,
}: {
  rotulo: string
  marcado: boolean
  onClique: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClique}
      aria-pressed={marcado}
      className="min-h-8 rounded-full px-3 py-1 text-sm"
      style={{
        borderWidth: marcado ? 2 : 1,
        borderStyle: 'solid',
        borderColor: marcado ? 'var(--brand)' : 'var(--border)',
        background: marcado ? 'var(--brand)' : 'var(--surface)',
        color: marcado ? 'var(--brand-text)' : 'var(--text)',
      }}
    >
      {rotulo}
    </button>
  )
}

/** O globo. SVG e não emoji: **esta máquina não tem fonte de emoji**, e o
 *  glifo virava quadrado vazio ao lado do texto (medido no JOB-04). */
function GlobeIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" />
    </svg>
  )
}
