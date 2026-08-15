import { useId, useState } from 'react'
import type { Opcoes, Selecao } from './vaga-filtro'
import { temSelecao } from './vaga-filtro'

/**
 * A busca por texto e as pílulas de filtro, no topo da lista.
 *
 * Tudo filtra **no cliente**, sobre a lista já carregada — não há parâmetro de
 * busca no `GET /jobs`, e não se inventa um que o backend não tem.
 *
 * As pílulas saem do dado carregado (`opcoesDe`), então nunca aparece um
 * filtro que não filtra nada. Grupo sem opção some inteiro: uma linha "Local"
 * vazia só ocupa espaço e sugere que a informação existe.
 */
export function BarraFiltros({
  opcoes,
  selecao,
  onChange,
  total,
  mostrando,
}: {
  opcoes: Opcoes
  selecao: Selecao
  onChange: (s: Selecao) => void
  /** Quantas vagas existem ao todo, antes de filtrar. */
  total: number
  /** Quantas sobraram depois de filtrar. */
  mostrando: number
}) {
  const idBusca = useId()
  const filtrando = temSelecao(selecao)

  /** Liga e desliga um valor dentro de um dos grupos de pílula. */
  const alternar = (grupo: 'skills' | 'locais' | 'fontes' | 'regimes', valor: string) => {
    const atual = selecao[grupo]
    onChange({
      ...selecao,
      [grupo]: atual.includes(valor)
        ? atual.filter((v) => v !== valor)
        : [...atual, valor],
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        {/* O rótulo existe e é visível para o leitor de tela, mas não ocupa
            linha: o placeholder sozinho não é nome acessível. */}
        <label htmlFor={idBusca} className="sr-only">
          Buscar título ou empresa
        </label>
        <input
          id={idBusca}
          type="search"
          value={selecao.busca}
          onChange={(e) => onChange({ ...selecao, busca: e.target.value })}
          placeholder="Buscar título ou empresa…"
          className="w-full rounded-md border px-3 py-2.5 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-sunken)',
            color: 'var(--text)',
          }}
        />
      </div>

      <GrupoPilulas
        rotulo="Skills"
        valores={opcoes.skills}
        // Teto de 12: a lista de skills tem cauda longa, e 40 pílulas
        // empurrariam a primeira vaga para fora da tela — o oposto do que a
        // tela existe para fazer. As mais frequentes são as que filtram mais.
        limite={12}
        marcados={selecao.skills}
        onAlternar={(v) => alternar('skills', v)}
      />
      <GrupoPilulas
        rotulo="Local"
        valores={opcoes.locais}
        limite={8}
        marcados={selecao.locais}
        onAlternar={(v) => alternar('locais', v)}
      />
      <GrupoPilulas
        rotulo="Escopo"
        valores={opcoes.regimes}
        limite={4}
        marcados={selecao.regimes}
        onAlternar={(v) => alternar('regimes', v)}
      />
      <GrupoPilulas
        rotulo="Fonte"
        valores={opcoes.fontes}
        limite={8}
        marcados={selecao.fontes}
        onAlternar={(v) => alternar('fontes', v)}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* A contagem é `aria-live`: filtrar não move o foco, e sem isto a
            lista encolher é uma mudança silenciosa para quem não vê a tela. */}
        <p role="status" aria-live="polite" className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {filtrando
            ? `${mostrando} de ${total} ${total === 1 ? 'vaga' : 'vagas'}`
            : `${total} ${total === 1 ? 'vaga' : 'vagas'}`}
        </p>

        {filtrando && (
          <button
            type="button"
            onClick={() => onChange({ busca: '', skills: [], locais: [], fontes: [], regimes: [] })}
            className="flex min-h-6 items-center rounded text-sm underline underline-offset-2"
            style={{ color: 'var(--text-muted)' }}
          >
            limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Uma linha de pílulas de um filtro só.
 *
 * `aria-pressed` e não checkbox: são botões que ligam e desligam, e o leitor
 * de tela anuncia "pressionado" — que é exatamente o estado. Cor sozinha nunca
 * marca o selecionado: a pílula ativa muda fundo **e** borda, e o
 * `aria-pressed` carrega o estado para quem não vê nenhum dos dois.
 */
function GrupoPilulas({
  rotulo,
  valores,
  limite,
  marcados,
  onAlternar,
}: {
  rotulo: string
  valores: string[]
  limite: number
  marcados: string[]
  onAlternar: (v: string) => void
}) {
  // O teto existe para a barra não virar um muro de pílulas. Mas o que ficou
  // de fora precisa ser ALCANÇÁVEL: sem isto, uma vaga mostra "Kotlin" no
  // cartão e não há como filtrar por Kotlin — a barra estaria escondendo
  // opções sem dizer que existem.
  const [expandido, setExpandido] = useState(false)
  // Um grupo sem opção não vira linha vazia — some.
  if (valores.length === 0) return null

  // O que está marcado nunca some por causa do teto: a pílula desapareceria
  // ainda ativa, e a lista ficaria filtrada por algo invisível.
  const dentroDoTeto = [...new Set([...marcados, ...valores.slice(0, limite)])]
  const escondidas = valores.filter((v) => !dentroDoTeto.includes(v))
  const visiveis = expandido ? [...dentroDoTeto, ...escondidas] : dentroDoTeto

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="mr-0.5 shrink-0 text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {rotulo}
      </span>
      {visiveis.map((valor) => {
        const ativo = marcados.includes(valor)
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(valor)}
            className="flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs"
            style={{
              borderColor: ativo ? 'var(--brand)' : 'var(--border)',
              background: ativo ? 'var(--brand)' : 'var(--surface)',
              color: ativo ? 'var(--brand-text)' : 'var(--text-muted)',
            }}
          >
            {valor}
          </button>
        )
      })}
      {escondidas.length > 0 && (
        <button
          type="button"
          onClick={() => setExpandido((e) => !e)}
          className="flex min-h-6 items-center rounded-full px-2 py-0.5 text-xs underline"
          style={{ color: 'var(--text-muted)' }}
        >
          {expandido ? 'menos' : `+${escondidas.length}`}
        </button>
      )}
    </div>
  )
}
