import { useCallback } from 'react'
import { BotaoGoogle } from '../components/BotaoGoogle'
import { ListaVagas } from '../components/vagas/ListaVagas'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useSessao } from '../lib/sessao'
import type { AuthUser } from '../types/api'

/**
 * A página de vagas: barra de filtros e lista, e mais nada.
 *
 * **O formulário de perfil saiu daqui** (decisão do stakeholder, 15/08/2026):
 * "não vai precisar desse formulário, somente os filtros". O perfil continua
 * existindo no backend — é ele que o job de 50 minutos usa para buscar —, só
 * não é mais editado nesta tela. A parte de CV vira outra coisa depois.
 *
 * A largura é maior que a das outras páginas (`max-w-6xl` contra `max-w-3xl`):
 * a linha densa tem uma faixa de chips que precisa caber sem quebrar em cinco
 * fileiras, e é o que a captura de referência mostra.
 */
export function VagasPage({ salvas = false }: { salvas?: boolean } = {}) {
  useDocumentTitle(salvas ? 'Saved jobs' : 'Jobs')
  const sessao = useSessao()

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/*
        **O título continua existindo, invisível.**

        O `<h1>` visível saiu em 26/08 — a barra de busca é o que a pessoa veio
        usar, e o cabeçalho a empurrava para baixo sem dizer nada que a aba do
        navegador e a navegação já não digam.

        Vira `sr-only` em vez de sumir: uma página sem `<h1>` deixa quem navega
        por landmarks sem saber onde chegou, e o leitor de tela anuncia "Jobs"
        ao entrar. O `useDocumentTitle('Jobs')` acima cuida da aba.

        O respiro de cima também encolheu (py-10/14 → py-6/8): sem o
        cabeçalho, aquele espaço era só vazio antes da barra.
      */}
      <h1 className="sr-only">Jobs</h1>

      {/* A rota exige sessão porque as vagas são de alguém: o backend não tem
          @Public() nem @SessaoOpcional() aqui. Mostrar a lista para quem não
          entrou daria 401 e um erro no lugar de uma explicação. */}
      {sessao ? (
        <ListaVagas verSalvas={salvas} />
      ) : (
        <ConviteParaEntrar />
      )}
    </main>
  )
}

/** Sem sessão não há lista — há um convite que explica o porquê. */
function ConviteParaEntrar() {
  // O App guarda a sessão; entrar aqui recarrega para o contexto reabrir com o
  // usuário. É uma tela só, e recarregar evita duplicar o estado de sessão.
  const aoEntrar = useCallback((_u: AuthUser) => {
    window.location.reload()
  }, [])

  return (
    <section
      className="rounded-xl border p-6"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      aria-labelledby="entrar-titulo"
    >
      <h2 id="entrar-titulo" className="text-lg font-semibold">
        Sign in to see your jobs
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        The jobs we find are yours: they are stored in your account, and the
        search runs with your profile. Sign in with Google to see them.
      </p>
      <div className="mt-4">
        <BotaoGoogle onEntrou={aoEntrar} tamanho="normal" />
      </div>
    </section>
  )
}
