import { useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '../States'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { BarraFiltros } from './BarraFiltros'
import { LinhaVaga } from './LinhaVaga'
import { SELECAO_VAZIA, filtrar, opcoesDe, temSelecao } from './vaga-filtro'
import type { Selecao } from './vaga-filtro'

/**
 * A lista de vagas encontradas.
 *
 * Ordenada por **data**, que é como o backend já devolve (`postedAt desc`,
 * `foundAt desc`) — e não por nota: o stakeholder dispensou a nota, e sem nota
 * não há ordenação por nota. Reordenar aqui só desfaria a ordem que o backend
 * escolheu.
 *
 * A filtragem é no cliente, sobre a lista já carregada: o `GET /jobs` não
 * aceita parâmetro nenhum. A seleção aplicada vive aqui, e não dentro da barra,
 * porque é ela que decide o que a lista mostra — a barra edita um rascunho e o
 * entrega no clique de "Filtrar".
 */
export function ListaVagas() {
  const { data, loading, error, reload } = useAsync((signal) => api.listarVagas(signal), [])
  const [selecao, setSelecao] = useState<Selecao>(SELECAO_VAZIA)

  const vagas = useMemo(() => data ?? [], [data])
  const opcoes = useMemo(() => opcoesDe(vagas), [vagas])
  const visiveis = useMemo(() => filtrar(vagas, selecao), [vagas, selecao])

  if (loading) return <LoadingState label="Carregando as vagas encontradas…" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const filtroAtivo = temSelecao(selecao)

  return (
    <div className="flex flex-col gap-4">
      {/* A barra aparece SEMPRE, inclusive sem vaga nenhuma. Antes ela so
          existia quando havia resultado, e a tela vazia nao tinha filtro
          algum — quem chegava via um aviso e mais nada, sem entender que a
          pagina era de busca. */}
      <BarraFiltros
        opcoes={opcoes}
        onAplicar={setSelecao}
        total={vagas.length}
        mostrando={visiveis.length}
        filtroAtivo={filtroAtivo}
      />

      {vagas.length === 0 ? (
        <NenhumaVagaAinda />
      ) : visiveis.length === 0 ? (
        // O vazio de filtro é outro problema que o vazio de lista: aqui há
        // vagas, e o que falta é afrouxar o filtro. Dizer "a busca roda
        // sozinha" seria responder a pergunta errada.
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhuma das {vagas.length} vagas bate com esses filtros.
        </p>
      ) : (
        // `border-t` na lista para a primeira linha ter divisória em cima
        // também — sem ela a primeira vaga fica colada no contador e não
        // parece parte da mesma lista.
        <ul className="flex flex-col border-t" style={{ borderColor: 'var(--border)' }}>
          {visiveis.map((vaga) => (
            <LinhaVaga key={vaga.id} vaga={vaga} />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * O estado vazio — **a primeira tela de todo mundo**.
 *
 * É a única chance de explicar que a busca roda sozinha, e o card é explícito:
 * precisa dizer que a pessoa **será avisada**, porque foi decisão do
 * stakeholder que ninguém fica esperando olhando a tela.
 *
 * Não usa o `EmptyState` de `States.tsx` de propósito: aquele é um parágrafo
 * centralizado de uma linha, e aqui o vazio tem trabalho a fazer.
 */
function NenhumaVagaAinda() {
  return (
    <section
      aria-labelledby="sem-vagas-titulo"
      className="rounded-xl border p-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <h2 id="sem-vagas-titulo" className="text-lg font-semibold">
        Nenhuma vaga ainda
      </h2>
      {/* NAO diz "para o seu perfil": o formulario de perfil saiu da tela, e
          prometer um perfil que a pessoa nunca criou e mentir sobre o estado
          do sistema. */}
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        A busca roda sozinha a cada 50 minutos. Você não precisa ficar nesta
        tela — as vagas ficam guardadas aqui esperando por você.
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Se a primeira rodada ainda não aconteceu, isso pode levar até uma hora.
      </p>
    </section>
  )
}
