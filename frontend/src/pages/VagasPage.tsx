import { useCallback } from 'react'
import { BotaoGoogle } from '../components/BotaoGoogle'
import { ListaVagas } from '../components/vagas/ListaVagas'
import { AssinaturaEmail } from '../components/vagas/AssinaturaEmail'
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
export function VagasPage() {
  useDocumentTitle('Jobs')
  const sessao = useSessao()

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Jobs</h1>
        {/* Uma linha, nao quatro: no celular o paragrafo anterior ocupava
            104px e empurrava a primeira vaga para fora da dobra. A promessa
            ("nao precisa ficar olhando") cabe em meia frase. */}
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Set your filters and search — we scan job boards and read each listing.
        </p>
      </header>

      {/* A rota exige sessão porque as vagas são de alguém: o backend não tem
          @Public() nem @SessaoOpcional() aqui. Mostrar a lista para quem não
          entrou daria 401 e um erro no lugar de uma explicação. */}
      {sessao ? (
        <>
          <ListaVagas />
          <AssinaturaEmail />
        </>
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
        Entre para ver as suas vagas
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        As vagas encontradas são suas: ficam guardadas na sua conta, e a busca
        roda com o seu perfil. Entre com o Google para vê-las.
      </p>
      <div className="mt-4">
        <BotaoGoogle onEntrou={aoEntrar} tamanho="normal" />
      </div>
    </section>
  )
}
