import { ErrorState, LoadingState } from '../components/States'
import { api } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/** O papel como se lê, e não como se guarda. */
const PAPEL: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  USER: 'Member',
}

/**
 * A conta de quem está logado.
 *
 * **Só leitura, por enquanto.** O que há para mostrar hoje vem do Google —
 * foto, nome e e-mail — e nada disso se edita aqui: mudar significaria mudar
 * na conta Google, e um campo que finge ser editável e volta ao valor antigo
 * na próxima carga é pior que campo nenhum.
 *
 * A página cresce com o [PLT-09](docs/backlog/cards/PLT-09-cadastro-em-dois-tempos.md):
 * nacionalidade, documento e telefone entram aqui quando houver contratação —
 * e aí sim haverá o que editar.
 */
export function PerfilPage() {
  useDocumentTitle('Profile')
  const { data: user, loading, error, reload } = useAsync((s) => api.me(s), [])

  return (
    <main id="conteudo" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Profile
      </h1>

      {loading && <LoadingState label="Loading your profile…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {user && (
        <>
          <div className="mt-6 flex items-center gap-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                // Decorativo: o nome está ao lado, e um alt repetindo "Foto de
                // Fulano" faria o leitor de tela dizer duas vezes a mesma coisa.
                alt=""
                aria-hidden
                className="h-16 w-16 shrink-0 rounded-full object-cover"
                style={{ background: 'var(--surface-sunken)' }}
              />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-lg font-medium" style={{ color: 'var(--text)' }}>
                {user.name}
              </p>
              <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                {user.email}
              </p>
            </div>
          </div>

          <dl
            className="mt-8 divide-y rounded-xl border"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Role
              </dt>
              <dd className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {PAPEL[user.role] ?? user.role}
              </dd>
            </div>
            <div
              className="flex items-baseline justify-between gap-4 px-4 py-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <dt className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Signed in with
              </dt>
              <dd className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Google
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Your name and photo come from your Google account — change them
            there and they update here on your next sign-in.
          </p>
        </>
      )}
    </main>
  )
}
