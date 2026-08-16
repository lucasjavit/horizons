import { useCallback, useState } from 'react'
import { Recolhivel } from '../Recolhivel'
import { DropdownFiltro } from './DropdownFiltro'
import { SELECAO_VAZIA, temSelecao } from './vaga-filtro'
import type { Eixo, Opcoes, Selecao } from './vaga-filtro'

/** O rótulo de cada eixo, na ordem da tela. */
const ROTULOS: ReadonlyArray<{ eixo: Eixo; rotulo: string }> = [
  { eixo: 'cargos', rotulo: 'Job title' },
  { eixo: 'experiencias', rotulo: 'Experience' },
  { eixo: 'contratos', rotulo: 'Employment type' },
  { eixo: 'skills', rotulo: 'Skills' },
  { eixo: 'beneficios', rotulo: 'Benefits' },
  { eixo: 'paises', rotulo: 'I want to work from' },
  { eixo: 'formacoes', rotulo: 'Degree' },
  { eixo: 'salarios', rotulo: 'Minimum yearly salary' },
]

/**
 * A barra de oito dropdowns.
 *
 * **O rascunho é local e só o botão "Filtrar" o promove.** A alternativa —
 * aplicar a cada checkbox — foi descartada porque com oito eixos a lista
 * saltaria embaixo do dedo no meio da escolha, e o contador "12 de 240" mudaria
 * três vezes antes de a pessoa terminar de decidir.
 *
 * O preço é o rascunho poder divergir do que a lista mostra, e é por isso que
 * "Filtrar" **continua habilitado mesmo sem mudança**: um botão que desabilita
 * sozinho deixaria a pessoa sem como confirmar que o que ela vê é o que ela
 * pediu.
 */
export function BarraFiltros({
  opcoes,
  onAplicar,
  buscando,
  encontradas,
}: {
  opcoes: Opcoes
  onAplicar: (s: Selecao) => void
  buscando: boolean
  encontradas: number
  /** Se há filtro **aplicado** — não o rascunho. É o que decide o contador. */
}) {
  const [rascunho, setRascunho] = useState<Selecao>(SELECAO_VAZIA)

  const editar = useCallback((eixo: Eixo, valores: string[]) => {
    setRascunho((r) => ({ ...r, [eixo]: valores }))
  }, [])

  const limpar = useCallback(() => {
    setRascunho(SELECAO_VAZIA)
    onAplicar(SELECAO_VAZIA)
  }, [onAplicar])

  // "Limpar" some quando não há nada para limpar — nem no rascunho, nem
  // aplicado. Um botão que não faz nada só ocupa o lugar do que faz.
  const podeLimpar = temSelecao(rascunho)

  // Recolhido so no celular. Comeca fechado: a lista e o conteudo, o filtro e
  // a ferramenta.
  const [aberto, setAberto] = useState(false)
  const quantosMarcados = ROTULOS.reduce(
    (n, { eixo }) => n + rascunho[eixo].length,
    0,
  )

  return (
    <section aria-labelledby="filtros-titulo" className="flex flex-col gap-3">
      <h2 id="filtros-titulo" className="sr-only">
        Filter jobs
      </h2>

      {/* No celular os oito dropdowns empilham em coluna e ocupam ~400px
          antes da primeira vaga — a tela inteira de filtro, e a lista some
          abaixo da dobra. Ficam recolhidos ali, e sempre abertos a partir de
          sm, onde cabem em duas linhas de quatro como na referencia. */}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls="painel-filtros"
        className="inline-flex min-h-9 items-center gap-2 self-start rounded-md border px-3 py-1.5 text-sm sm:hidden"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        Filters
        {quantosMarcados > 0 && (
          <span
            className="rounded-full px-1.5 text-xs font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {quantosMarcados}
          </span>
        )}
        <span aria-hidden>{aberto ? '▴' : '▾'}</span>
      </button>

      <div className="hidden sm:block">
        <PainelDropdowns
          opcoes={opcoes}
          rascunho={rascunho}
          editar={editar}
        />
      </div>
      <div id="painel-filtros" className="sm:hidden">
        <Recolhivel aberto={aberto}>
          <PainelDropdowns opcoes={opcoes} rascunho={rascunho} editar={editar} />
        </Recolhivel>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* A captura tem 🔍 e ✕ nos botões, e eles ficaram de fora: emoji
            depende de fonte do sistema, e **esta máquina não tem nenhuma** —
            os dois viravam quadrados vazios ao lado do texto. Um glifo
            decorativo que falha é pior que glifo nenhum, porque o quadrado
            parece defeito. O texto sozinho já nomeia a ação. */}
        <button
          type="button"
          disabled={buscando}
          onClick={() => onAplicar(rascunho)}
          className="inline-flex min-h-9 items-center rounded-md px-4 py-1.5 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          {buscando ? 'Searching…' : 'Filter'}
        </button>

        {podeLimpar && (
          <button
            type="button"
            onClick={limpar}
            className="inline-flex min-h-9 items-center rounded-md border px-4 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* O "240 jobs found" da captura. `aria-live` porque depois de clicar em
          "Filtrar" esta é a única confirmação de que algo aconteceu — sem ela,
          quem usa leitor de tela clica e não ouve nada mudar. */}
      <p
        role="status"
        aria-live="polite"
        className="text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        {buscando
          ? 'Searching…'
          : `${encontradas} ${encontradas === 1 ? 'job found' : 'jobs found'}`}
      </p>
    </section>
  )
}


/** Os oito dropdowns. Extraido porque aparece duas vezes: solto no desktop,
 *  dentro do Recolhivel no celular. */
function PainelDropdowns({
  opcoes,
  rascunho,
  editar,
}: {
  opcoes: Opcoes
  rascunho: Selecao
  editar: (eixo: keyof Selecao, valores: string[]) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {ROTULOS.map(({ eixo, rotulo }) => (
        <DropdownFiltro
          key={eixo}
          rotulo={rotulo}
          opcoes={opcoes[eixo]}
          marcados={rascunho[eixo]}
          onChange={(v) => editar(eixo, v)}
        />
      ))}
    </div>
  )
}
