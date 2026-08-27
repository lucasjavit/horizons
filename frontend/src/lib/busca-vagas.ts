import type { Vaga } from '../types/api'
import { tokenStore } from './auth'

export interface EventoBusca {
  tipo: 'inicio' | 'vaga' | 'fim' | 'erro'
  total?: number
  vaga?: Vaga
  mensagem?: string
  /** Em `fim`: o id da sessão de cache, para pedir a próxima página (JOB-45). */
  sessao?: string
  /** Em `fim`: há mais páginas para buscar nesta sessão? */
  temMais?: boolean
  /** Em `fim`: quantas vagas o filtro tem no catálogo, quando se sabe. */
  totalNoFiltro?: number | null
}

/**
 * A busca ao vivo, lida evento a evento.
 *
 * `fetch` + `ReadableStream` em vez de `EventSource`: os filtros vão no corpo,
 * e o EventSource do navegador só faz GET. Também é o que permite mandar o
 * `Authorization` — o EventSource não aceita cabeçalho.
 *
 * O `signal` existe para a tela parar a busca quando a pessoa sai da página ou
 * clica em Filter de novo: sem ele, duas buscas escreveriam na mesma lista.
 */
export async function* buscarVagas(
  filtros: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<EventoBusca> {
  const token = tokenStore.get()
  const resposta = await fetch(
    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api'}/jobs/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(filtros),
      signal,
    },
  )

  if (!resposta.ok || !resposta.body) {
    // **4xx é o servidor RESPONDENDO, e a resposta diz o que houve.**
    //
    // Tratar tudo como "não alcancei o servidor" descartava o corpo e mentia
    // duas vezes (QA, 26/08): o termo de busca com mais de 80 caracteres
    // devolvia 400 explicando o limite, e a tela dizia que o servidor estava
    // fora — depois de ele ter respondido.
    if (resposta.status >= 400 && resposta.status < 500) {
      const corpo = (await resposta.json().catch(() => null)) as
        | { message?: string | string[] }
        | null
      const m = corpo?.message
      const texto = Array.isArray(m) ? m[0] : m
      yield {
        tipo: 'erro',
        mensagem: texto || 'The server rejected this search.',
      }
      return
    }
    yield { tipo: 'erro', mensagem: 'Could not reach the server.' }
    return
  }

  const leitor = resposta.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await leitor.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Um evento SSE termina em linha em branco. O corte é aqui, e não a cada
    // chunk: um evento pode chegar partido em dois pedaços de rede.
    const partes = buffer.split('\n\n')
    buffer = partes.pop() ?? ''
    for (const parte of partes) {
      const linha = parte.split('\n').find((l) => l.startsWith('data: '))
      if (!linha) continue
      try {
        yield JSON.parse(linha.slice(6)) as EventoBusca
      } catch {
        // Evento malformado não derruba a busca inteira.
      }
    }
  }
}
