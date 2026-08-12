import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from './api'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Carrega dados de uma função assíncrona, cancelando a requisição anterior
 * quando as dependências mudam (evita que uma resposta antiga sobrescreva
 * a nova ao navegar rápido entre aulas).
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { setData: (value: T) => void; reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  })
  const [nonce, setNonce] = useState(0)

  // `load` muda de identidade a cada render; as deps declaradas pelo chamador
  // é que definem quando recarregar.
  const run = useCallback(load, deps)

  useEffect(() => {
    const controller = new AbortController()
    let ativo = true

    setState((atual) => ({ ...atual, loading: true, error: null }))

    run(controller.signal)
      .then((data) => {
        if (ativo) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!ativo || controller.signal.aborted) return
        setState({ data: null, loading: false, error: errorMessage(error) })
      })

    return () => {
      ativo = false
      controller.abort()
    }
  }, [run, nonce])

  const setData = useCallback((value: T) => {
    setState((atual) => ({ ...atual, data: value }))
  }, [])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { ...state, setData, reload }
}
