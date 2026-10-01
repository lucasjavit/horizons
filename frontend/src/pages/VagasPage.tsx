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

      {/*
        **A busca aparece para todo mundo desde o JOB-47** (01/10/2026):
        *"não precisa de login para fazer buscas"*. `POST /jobs/search` é
        `@SessaoOpcional()`, e o anônimo recebe o motor gratuito e a vaga com
        14+ dias — ver `backend/src/jobs/limites-anonimos.ts`.

        **A aba "Saved" continua exigindo sessão**, e é a única exceção aqui: a
        lista de salvas é de alguém por definição, e `GET /jobs/saved` é rota
        protegida. Mostrá-la ao anônimo daria 401 e um erro no lugar de uma
        explicação — que é exatamente o que o convite abaixo evita.
      */}
      {salvas && !sessao ? <ConviteParaVerSalvas /> : <ListaVagas verSalvas={salvas} />}
    </main>
  )
}

/**
 * A aba "Saved" sem sessão: um convite que explica o que se ganha.
 *
 * **"Sign in to save jobs", e não "Unauthorized"** — é o critério 6 do JOB-47.
 * O texto diz o que a conta acrescenta, porque é essa a pergunta de quem
 * chegou aqui sem ter entrado.
 */
function ConviteParaVerSalvas() {
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
        Sign in to save jobs
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Saved jobs live in your account, so they are here on your next visit and
        on your other devices. Searching needs no account — only saving does.
      </p>
      <div className="mt-4">
        <BotaoGoogle onEntrou={aoEntrar} tamanho="normal" />
      </div>
    </section>
  )
}
