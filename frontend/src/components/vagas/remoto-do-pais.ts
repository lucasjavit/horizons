import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Vaga, VereditoRemoto } from '../../types/api'

/**
 * "Dá para fazer esta vaga remotamente morando no meu país?" (JOB-55).
 *
 * A pergunta é respondida pela IA no servidor, lendo o anúncio. Aqui mora só
 * o que a tela precisa: pedir os vereditos das vagas **visíveis**, depois que
 * a lista já apareceu, e nunca atrasar nem quebrar a lista por causa disso.
 */

/** O que a linha da vaga mostra no selo. */
export type SeloRemoto =
  | { tipo: 'verificando'; pais: string | null }
  | { tipo: 'veredito'; pais: string; veredito: VereditoRemoto['veredito']; trecho: string | null }

export interface RemotoDoPais {
  /**
   * `inativo` — sem sessão, interruptor desligado ou verificação fora do ar:
   * a tela é a de antes do card. `sem_pais` — a pessoa não disse onde mora.
   */
  estado: 'inativo' | 'ok' | 'sem_pais'
  /** O país da pessoa, em inglês. `null` até a primeira resposta. */
  pais: string | null
  /** O selo de uma vaga, ou `undefined` quando não há o que mostrar. */
  seloDe: (id: string) => SeloRemoto | undefined
  /** Ainda há vaga visível esperando resposta. */
  verificando: boolean
}

/**
 * Pede os vereditos das vagas visíveis.
 *
 * **Falha é silenciosa, de propósito**: a verificação é um acréscimo, e uma
 * lista de vagas não mostra erro porque o acréscimo não veio — a linha fica
 * com a resposta por campo, sem selo.
 */
export function useRemotoDoPais(visiveis: Vaga[], ativo: boolean): RemotoDoPais {
  const [estado, setEstado] = useState<RemotoDoPais['estado']>('inativo')
  const [pais, setPais] = useState<string | null>(null)
  const [vereditos, setVereditos] = useState<Map<string, VereditoRemoto>>(new Map())
  const [pendentes, setPendentes] = useState<Set<string>>(new Set())
  // Já perguntado — com ou sem resposta. Vaga que o servidor não conseguiu
  // ler não é perguntada de novo a cada render; volta a ser na próxima carga.
  const pedidos = useRef<Set<string>>(new Set())
  // O servidor disse "desligado" ou "sem país": perguntar de novo a cada
  // página só repetiria a mesma resposta.
  const parou = useRef(false)

  // A chave é o conteúdo, e não a identidade do array: `visiveis` é recriado
  // a cada vaga que chega pelo stream, e o efeito não pode disparar 25 vezes.
  const chave = visiveis.map((v) => v.id).join('\n')

  useEffect(() => {
    if (!ativo || parou.current) return
    const faltam = chave.split('\n').filter((id) => id && !pedidos.current.has(id))
    if (faltam.length === 0) return

    // Espera a lista assentar: durante o stream as vagas chegam uma a uma, e
    // sem isto cada chegada viraria um pedido de uma vaga só.
    const ctrl = new AbortController()
    const espera = setTimeout(() => {
      faltam.forEach((id) => pedidos.current.add(id))
      setPendentes((p) => new Set([...p, ...faltam]))
      void (async () => {
        // **Em lotes pequenos, um depois do outro.** Medido em 05/10: as 25
        // vagas num pedido só levaram 64 s (três provedores recusando antes
        // de um responder), mais que o timeout do cliente HTTP — o navegador
        // desistia e a página ficava sem selo nenhum. Em lotes, os selos
        // aparecem aos poucos e nenhum pedido passa do limite.
        for (let i = 0; i < faltam.length; i += LOTE) {
          const lote = faltam.slice(i, i + LOTE)
          const resto = faltam.slice(i)
          const soltar = (ids: string[]) =>
            setPendentes((p) => {
              const novo = new Set(p)
              ids.forEach((id) => novo.delete(id))
              return novo
            })
          try {
            const r = await api.verificarRemoto(lote, ctrl.signal)
            if (r.estado !== 'ok') {
              parou.current = true
              setEstado(r.estado === 'sem_pais' ? 'sem_pais' : 'inativo')
              soltar(resto)
              return
            }
            setEstado('ok')
            setPais(r.pais)
            setVereditos((m) => {
              const novo = new Map(m)
              r.vereditos.forEach((v) => novo.set(v.id, v))
              return novo
            })
            soltar(lote)
          } catch {
            // Pedido cancelado (a página mudou) ou falhou: o que faltava volta
            // a poder ser perguntado quando ficar visível de novo.
            resto.forEach((id) => pedidos.current.delete(id))
            soltar(resto)
            return
          }
        }
      })()
    }, ESPERA_MS)

    return () => {
      clearTimeout(espera)
      ctrl.abort()
    }
  }, [chave, ativo])

  return useMemo(
    () => ({
      estado,
      pais,
      verificando: pendentes.size > 0,
      seloDe: (id: string): SeloRemoto | undefined => {
        const v = vereditos.get(id)
        if (v && pais) return { tipo: 'veredito', pais, veredito: v.veredito, trecho: v.trecho }
        if (pendentes.has(id)) return { tipo: 'verificando', pais }
        return undefined
      },
    }),
    [estado, pais, vereditos, pendentes],
  )
}

/** Quantas vagas por pedido. O servidor lê 4 ao mesmo tempo. */
const LOTE = 5

/** Quanto a lista precisa ficar parada antes de a verificação sair. */
export const ESPERA_MS = 400

/**
 * O que o filtro "Only jobs I can do from X" diz sobre a página.
 *
 * `semResposta` junta o que o anúncio não diz com o que não foi possível
 * verificar: para quem lê, as duas são "não sei" — e esconder vaga sem dizer
 * quantas ficaram de fora faria o filtro parecer um veredito sobre todas.
 */
export function resumoDoFiltro(
  visiveis: Vaga[],
  seloDe: RemotoDoPais['seloDe'],
): { sim: Vaga[]; nao: number; semResposta: number } {
  const sim: Vaga[] = []
  let nao = 0
  let semResposta = 0
  for (const v of visiveis) {
    const s = seloDe(v.id)
    if (s?.tipo === 'veredito' && s.veredito === 'sim') sim.push(v)
    else if (s?.tipo === 'veredito' && s.veredito === 'nao') nao++
    else semResposta++
  }
  return { sim, nao, semResposta }
}
