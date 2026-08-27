import { useLayoutEffect, useState } from 'react'
import { usePopover } from '../../lib/usePopover'
import { HintWrap } from '../Hint'
import { BOTAO_ESCOPO } from './BarraDeBusca'

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
  const { aberto: fixado, alternar, caixa, gatilho } = usePopover()
  const [emHover, setEmHover] = useState(false)
  /**
   * Para que lado o painel abre.
   *
   * **Medido, e não fixo.** Ele desceu até 26/08, quando o console de busca
   * (JOB-44) pôs a faixa de chips logo abaixo da barra — e o painel passou a
   * cobrir os filtros que a pessoa acabou de escolher. Fixar `bottom-full`
   * também não serve: com a barra a 152px do topo e o painel a 314px, ele
   * saía 170px para fora da janela (medido).
   *
   * Então a regra é o espaço: abre para cima quando cabe, e desce quando não
   * cabe. Sem biblioteca — é uma conta de `getBoundingClientRect`.
   */
  const [paraCima, setParaCima] = useState(false)
  // Hover abre, sair fecha, clique FIXA — igual à etiqueta de filtros. Só
  // hover fecharia o popover no caminho até uma pílula; só clique perderia a
  // espiada rápida. No toque não há hover, e o clique já resolve.
  const aberto = fixado || emHover

  useLayoutEffect(() => {
    if (!aberto) return
    const g = gatilho.current?.getBoundingClientRect()
    if (!g) return
    // A altura real do painel, e não uma constante: ele cresce com o número
    // de regiões que o catálogo devolve.
    const alturaDoPainel = caixa.current?.offsetHeight ?? 0
    const FOLGA = 12
    setParaCima(
      g.top - alturaDoPainel - FOLGA > 0 &&
        window.innerHeight - g.bottom < alturaDoPainel + FOLGA,
    )
  }, [aberto, caixa, gatilho])

  const alternarEm = (lista: string[], valor: string): string[] =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]

  const marcados = formatos.length + regioes.length

  return (
    <div
      ref={caixa}
      // `flex-1` no celular: os três controles da faixa (Location, All
      // filters, Search) dividem a segunda linha em partes iguais.
      className="relative flex-1 sm:flex-none"
      onMouseEnter={() => setEmHover(true)}
      onMouseLeave={() => setEmHover(false)}
    >
      <HintWrap
        title="Location & format"
        texto="Where you want to work from, and whether the job is remote, hybrid or on-site."
        suprimido={aberto}
      >
      <button
        ref={gatilho}
        type="button"
        onClick={() => {
          alternar()
          setEmHover(false)
        }}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={marcados > 0 ? `Location, ${marcados} active` : 'Location'}
        // **Mesmo corpo que `All filters` e `Search`** (27/08). Era uma
        // pílula de 125px ao lado de um `All filters` de 38px — a hierarquia
        // invertida que o redesenho corrige. `BOTAO_ESCOPO` é a forma comum
        // dos três.
        className={`w-full ${BOTAO_ESCOPO}`}
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        <GlobeIcon />
        <span>Location</span>
        {/* O contador substitui o "+1" da referência: ali é um código de
            telefone, aqui é quantos filtros de lugar estão ligados — o número
            só significa algo se contar o que a pessoa escolheu.

            `sm:hidden` pela mesma razão do `All filters`: no desktop os chips
            logo abaixo já dizem QUAIS lugares estão ligados, e o número
            repetiria isso pior. No celular eles rolam para fora de vista. A
            contagem continua no `aria-label` nas duas larguras. */}
        {marcados > 0 && (
          <span
            aria-hidden
            className="rounded-full px-1.5 text-xs tabular-nums sm:hidden"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {marcados}
          </span>
        )}
        <Chevron paraCima={aberto} />
      </button>
      </HintWrap>

      {aberto && (
        <div
          role="dialog"
          aria-label="Location and format"
          // `right-0`: o gatilho fica na metade direita da barra desde
          // 26/08, e um painel de 19rem alinhado à esquerda vazaria o quadro.
          className={`absolute right-0 z-30 w-[19rem] rounded-xl border p-4 shadow-lg ${
            paraCima ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Location &amp; format</p>
            {/* Limpar os dois eixos de uma vez. Só aparece quando há o que
                limpar — botão inerte ocupa o lugar do que age. */}
            {marcados > 0 && (
              <button
                type="button"
                onClick={() => onMudar([], [])}
                className="inline-flex min-h-6 items-center rounded px-1 text-xs underline underline-offset-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            )}
          </div>

          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
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
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
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
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors hover:brightness-110"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: marcado ? 'var(--brand)' : 'var(--border)',
        background: marcado ? 'var(--brand)' : 'var(--surface)',
        color: marcado ? 'var(--brand-text)' : 'var(--text)',
      }}
    >
      {/* **O tique é o segundo sinal.** `aria-pressed` cobre o leitor de tela,
          mas na tela o marcado se distinguia só pelo verde — e a regra da casa
          é nunca deixar a cor sozinha carregando informação. */}
      {marcado && <span aria-hidden>✓</span>}
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

/** Seta que gira 180° ao abrir — a mesma forma dizendo os dois estados. */
function Chevron({ paraCima }: { paraCima: boolean }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform"
      style={{ transform: paraCima ? 'rotate(180deg)' : 'none' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
