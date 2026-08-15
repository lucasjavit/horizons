import { useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '../States'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { BarraFiltros } from './BarraFiltros'
import { CartaoVaga } from './CartaoVaga'
import { SELECAO_VAZIA, filtrar, opcoesDe } from './vaga-filtro'
import type { Selecao } from './vaga-filtro'

/**
 * A lista de vagas encontradas (JOB-04).
 *
 * Ordenada por **data**, que é como o backend já devolve (`postedAt desc`,
 * `foundAt desc`) — e não por nota: o stakeholder dispensou a nota, e sem nota
 * não há ordenação por nota. Reordenar aqui só desfaria a ordem que o backend
 * escolheu.
 *
 * Convive com o formulário de perfil na mesma página: quem ainda não cadastrou
 * perfil não chega aqui, porque `GET /jobs` devolve `[]` para essa pessoa e a
 * página mostra o formulário. Quem tem perfil e ainda não tem vaga vê o vazio
 * explicativo abaixo.
 */
export function ListaVagas() {
  const { data, loading, error, reload } = useAsync((signal) => api.listarVagas(signal), [])
  const [selecao, setSelecao] = useState<Selecao>(SELECAO_VAZIA)

  const vagas = useMemo(() => data ?? [], [data])
  const opcoes = useMemo(() => opcoesDe(vagas), [vagas])
  const visiveis = useMemo(() => filtrar(vagas, selecao), [vagas, selecao])

  if (loading) return <LoadingState label="Carregando as vagas encontradas…" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  if (vagas.length === 0) return <NenhumaVagaAinda />

  return (
    <section aria-labelledby="vagas-titulo" className="flex flex-col gap-4">
      <h2
        id="vagas-titulo"
        className="border-b pb-2 text-sm font-semibold uppercase tracking-wide"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        Vagas encontradas
      </h2>

      <BarraFiltros
        opcoes={opcoes}
        selecao={selecao}
        onChange={setSelecao}
        total={vagas.length}
        mostrando={visiveis.length}
      />

      {visiveis.length === 0 ? (
        // O vazio de filtro é outro problema que o vazio de lista: aqui há
        // vagas, e o que falta é afrouxar o filtro. Dizer "a busca roda
        // sozinha" seria responder a pergunta errada.
        <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhuma das {vagas.length} vagas bate com esses filtros.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visiveis.map((vaga) => (
            <CartaoVaga key={vaga.id} vaga={vaga} />
          ))}
        </ul>
      )}
    </section>
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
        Ainda não há vagas para o seu perfil
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        A busca roda sozinha a cada 50 minutos e usa o perfil que você salvou
        aqui. Você não precisa ficar nesta tela: <strong>nós avisamos quando
        aparecerem vagas novas</strong>, e elas ficam guardadas aqui esperando
        por você.
      </p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Se a primeira rodada ainda não aconteceu, isso pode levar até uma hora.
        Enquanto isso, quanto mais completo o perfil abaixo, melhor o que a
        busca traz.
      </p>
    </section>
  )
}
