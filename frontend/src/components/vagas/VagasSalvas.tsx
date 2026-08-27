import { useCallback, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { EmptyState, ErrorState, LoadingState } from '../States'
import { WARN_INK } from '../blocks/BlockRenderer'
import { LinhaVaga } from '../vagas/LinhaVaga'
import { POR_PAGINA, Paginacao } from '../vagas/Paginacao'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import type { Vaga } from '../../types/api'

/**
 * As vagas que a pessoa guardou.
 *
 * Aba própria, e não um painel na tela de busca: são momentos de uso
 * diferentes. Buscar é explorar; reler o que se guardou é preparar a
 * candidatura — e essa segunda coisa merece a tela inteira, sem oito filtros
 * disputando espaço.
 *
 * **O que se lê aqui é o retrato do dia em que ela salvou**, não o anúncio ao
 * vivo. A vaga sai do ar em semanas; o snapshot é o que sobrevive, com o
 * trecho de salário e elegibilidade que a torna conferível (JOB-09).
 */
/**
 * As vagas salvas, como VISÃO dentro da tela de Jobs (26/08).
 *
 * Era uma aba própria (`Saved`, ao lado de Jobs) e uma página inteira. Virou
 * uma visão porque buscar e reler o que se guardou acontecem no mesmo lugar:
 * a estrela da barra alterna entre as duas listas, e a barra, os filtros e a
 * paginação continuam onde estavam.
 *
 * A rota `/salvas` continua existindo — links antigos e o menu levam a ela —,
 * e ela renderiza a tela de Jobs já nesta visão.
 */
export function VagasSalvas() {
  const { data, loading, error, reload } = useAsync(
    (signal) => api.listarSalvas(signal),
    [],
  )
  /** Removidas nesta sessão, para a lista responder sem esperar a rede. */
  const [removidas, setRemovidas] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState('')
  /** Erro visível. `aria-live` sozinho só existe para leitor de tela. */
  const [erroRemocao, setErroRemocao] = useState('')
  /** Para onde o foco vai quando a linha some — senão cai no `<body>`. */
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const [pagina, setPagina] = useState(1)

  const remover = useCallback(async (vaga: Vaga) => {
    setRemovidas((s) => new Set(s).add(vaga.url))
    setAviso(`${vaga.title} removed from saved.`)
    setErroRemocao('')
    try {
      await api.removerSalva(vaga.url)
    } catch (e) {
      // **404 não é falha: é a vaga já não estar lá.**
      //
      // Medido pelo QA em 21/08: com a mesma lista aberta em duas abas,
      // remover na segunda devolvia 404 e a vaga REAPARECIA — o rollback
      // desfazia uma remoção que o servidor já tinha feito. O estado final
      // desejado (sumir) é o mesmo nos dois casos.
      if (e instanceof AxiosError && e.response?.status === 404) return

      // Qualquer outra falha volta atrás: sumir da tela e continuar no banco
      // é o pior dos dois mundos.
      setRemovidas((s) => {
        const p = new Set(s)
        p.delete(vaga.url)
        return p
      })
      setAviso(`Could not remove ${vaga.title}.`)
      setErroRemocao(`Could not remove "${vaga.title}". Check your connection and try again.`)
    }
  }, [])

  const todas = useMemo(
    () => (data ?? []).filter((v) => !removidas.has(v.url)),
    [data, removidas],
  )

  const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA))
  // Remover a última vaga de uma página não pode deixar a tela vazia: a
  // página se ajusta para a última que ainda existe.
  const atual = Math.min(pagina, paginas)
  const visiveis = todas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA)

  return (
    <div className="flex flex-col gap-2">
      {/* `tabIndex={-1}` porque o foco vem para cá quando uma linha some —
          senão cairia no `<body>` e o Tab recomeçaria do topo da página. */}
      <h2
        ref={tituloRef}
        tabIndex={-1}
        className="text-lg font-semibold"
        style={{ color: 'var(--text)' }}
      >
        Saved jobs
      </h2>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        These stay here for good — even after the original posting goes offline.
      </p>

      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {erroRemocao && (
        // Erro tem de ser VISÍVEL, não só anunciado: a convenção da casa é
        // "borda + aria-invalid + texto, nunca só cor" — e nunca só sr-only.
        <p
          role="alert"
          className="mt-4 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: WARN_INK, color: WARN_INK }}
        >
          {erroRemocao}
        </p>
      )}

      {loading && <LoadingState label="Loading saved jobs…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && todas.length === 0 && !loading && (
        <EmptyState message="Nothing saved yet. Star a job on the Jobs tab and it shows up here." />
      )}

      {todas.length > 0 && (
        <>
          <p className="mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            {todas.length} {todas.length === 1 ? 'job' : 'jobs'}
          </p>
          <ul
            className="mt-2 flex flex-col border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            {visiveis.map((vaga) => (
              <LinhaVaga
                key={vaga.id}
                vaga={vaga}
                salva
                onAlternarSalva={(v) => {
                  void remover(v)
                  // O foco não pode cair no `<body>`: a linha some, e quem
                  // navega por Tab recomeçaria do topo da página. Vai para o
                  // título, que é o marco estável da tela.
                  requestAnimationFrame(() => tituloRef.current?.focus())
                }}
              />
            ))}
          </ul>

          {paginas > 1 && (
            <Paginacao
              atual={atual}
              paginas={paginas}
              total={todas.length}
              onIr={(p) => {
                setPagina(p)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
