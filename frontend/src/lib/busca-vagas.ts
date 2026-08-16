import type { Vaga } from '../types/api'
import { tokenStore } from './auth'

export interface EventoBusca {
  tipo: 'inicio' | 'vaga' | 'fim' | 'erro'
  total?: number
  vaga?: Vaga
  mensagem?: string
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
