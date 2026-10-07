import {
  JANELA_MINIMA_DO_ANONIMO,
  JANELAS,
  ORDENS,
  rotuloDaJanela,
} from './ordem-e-data'
import type { OrdemDaBusca } from '../../types/api'

/**
 * `Posted` e `Sort`, logo abaixo do console de busca (JOB-54).
 *
 * **`<select>` nativo, e não um popover próprio.** São duas escolhas únicas
 * entre poucas opções: o nativo já entrega teclado, leitor de tela, o seletor
 * do celular e os dois temas (`color-scheme` no `index.css`), e um componente
 * novo teria de reconquistar cada um desses.
 *
 * Trocar qualquer um refaz a busca — quem decide isso é a `ListaVagas`; aqui
 * só se avisa o valor novo.
 */
export function OrdemEData({
  ordem,
  janela,
  onOrdem,
  onJanela,
  temTecnologia,
  anonimo,
}: {
  ordem: OrdemDaBusca
  /** Dias, ou `null` para `Any time`. */
  janela: number | null
  onOrdem: (o: OrdemDaBusca) => void
  onJanela: (dias: number | null) => void
  /**
   * Há tecnologia marcada (à mão ou pelo currículo)?
   *
   * `Best match` compara as skills da vaga com elas. Sem nenhuma, toda vaga
   * empata e a opção ordenaria por nada — então fica desabilitada, com a
   * frase que diz como habilitar.
   */
  temTecnologia: boolean
  /**
   * Sem sessão a ordem é fixa e a vaga nova não aparece (JOB-47). O seletor
   * fica visível e desabilitado, com o motivo, em vez de aceitar uma escolha
   * que o servidor vai ignorar.
   */
  anonimo: boolean
}) {
  // Janela que a tela não oferece mais (busca salva antiga): entra como opção
  // extra, senão o `<select>` mostraria `Any time` com 20 dias valendo.
  const janelaForaDaLista = janela !== null && !JANELAS.some((j) => j.dias === janela)

  const dica = anonimo
    ? 'Sign in to sort results and to see jobs posted in the last 14 days.'
    : !temTecnologia
      ? 'Best match needs skills: add some in All filters, or upload your CV.'
      : 'Best match ranks the jobs already loaded, in batches of 60 — not the whole catalogue.'

  const estilo = {
    borderColor: 'var(--border)',
    background: 'var(--surface-raised)',
    color: 'var(--text)',
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="busca-posted" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Posted
        </label>
        <select
          id="busca-posted"
          value={janela === null ? '' : String(janela)}
          onChange={(e) => onJanela(e.target.value === '' ? null : Number(e.target.value))}
          className="min-h-9 rounded-md border px-2 py-1 text-sm"
          style={estilo}
        >
          {JANELAS.map((j) => (
            <option
              key={j.dias ?? 'any'}
              value={j.dias === null ? '' : String(j.dias)}
              disabled={anonimo && j.dias !== null && j.dias < JANELA_MINIMA_DO_ANONIMO}
            >
              {j.rotulo}
            </option>
          ))}
          {janelaForaDaLista && <option value={String(janela)}>{rotuloDaJanela(janela)}</option>}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="busca-sort" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sort
        </label>
        <select
          id="busca-sort"
          value={ordem}
          disabled={anonimo}
          aria-describedby="busca-sort-dica"
          onChange={(e) => onOrdem(e.target.value as OrdemDaBusca)}
          className="min-h-9 rounded-md border px-2 py-1 text-sm disabled:opacity-60"
          style={estilo}
        >
          {ORDENS.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.valor === 'match' && !temTecnologia}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </div>

      <p id="busca-sort-dica" className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {dica}
      </p>
    </div>
  )
}
