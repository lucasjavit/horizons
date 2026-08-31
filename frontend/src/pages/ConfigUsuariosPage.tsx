import { useEffect, useId, useState } from 'react'
import { AbasDeConfig } from '../components/settings/AbasDeConfig'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { WARN_INK } from '../components/blocks/BlockRenderer'
import { Paginacao } from '../components/vagas/Paginacao'
import { api, errorMessage } from '../lib/api'
import { useAsync } from '../lib/useAsync'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { UsuarioDaLista } from '../types/api'

/** Como cada papel aparece na tela. O banco guarda a string crua. */
const ROTULO_DO_PAPEL: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  COMMON_USER: 'User',
}

/**
 * Data curta, ou um travessão.
 *
 * `—` e nao "Never": a coluna ja diz do que se trata, e "Never" repetido em
 * trinta linhas vira ruido. O `title` carrega a data completa para quem
 * precisa do horario.
 */
function Data({ iso, vazio }: { iso: string | null; vazio: string }) {
  if (!iso) {
    return (
      <span style={{ color: 'var(--text-muted)' }} title={vazio}>
        —
      </span>
    )
  }
  const d = new Date(iso)
  return (
    <time dateTime={iso} title={d.toLocaleString()}>
      {d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}
    </time>
  )
}

/** A etiqueta do papel. Cor só por token, e o texto carrega a informação. */
function Papel({ role }: { role: string }) {
  const admin = role === 'ADMIN'
  const manager = role === 'MANAGER'
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: admin || manager ? 'var(--brand)' : 'var(--border)',
        color: admin || manager ? 'var(--brand)' : 'var(--text-muted)',
      }}
    >
      {ROTULO_DO_PAPEL[role] ?? role}
    </span>
  )
}

/**
 * Quem se cadastrou, e o que fazer com cada conta (PLT-11).
 *
 * **Admin e manager veem a mesma lista; o que muda são os controles.** Quem
 * pode o quê não é decidido aqui: cada linha chega do servidor com
 * `canToggleActive` e `canChangeRole`, calculados pela MESMA função que o
 * `PATCH` usa para recusar. Repetir a regra no front é como as duas versões
 * divergem — e aí o botão aparece para um gesto que dá 403.
 *
 * Esconder o controle não substitui a proteção: quem chama a rota direto é
 * barrado igual.
 */
export function ConfigUsuariosPage() {
  useDocumentTitle('Users — Settings')

  const buscaId = useId()
  const [busca, setBusca] = useState('')
  // O que de fato vai para a API. Separado do que está digitado para a busca
  // não disparar uma requisição por tecla.
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(1)

  // 350ms: rápido o bastante para parecer imediato, lento o bastante para
  // "manager" não virar sete requisições.
  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(busca)
      // Voltar para a página 1 ao buscar: manter a 4 com um filtro novo mostra
      // uma lista vazia e parece que a busca não achou nada.
      setPagina(1)
    }, 350)
    return () => clearTimeout(t)
  }, [busca])

  const lista = useAsync(
    (signal) => api.usuarios(termo, pagina, signal),
    [termo, pagina],
  )

  // Erro de mutação num useState separado do erro do useAsync: um 403 ao
  // desativar não pode apagar a lista que está na tela.
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  // Quem está esperando confirmação para ser desativado. Um id, e não um
  // booleano: com duas linhas em confirmação ao mesmo tempo ninguém sabe qual
  // botão confirma qual conta.
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const data = lista.data

  /** Troca uma linha no lugar, sem recarregar a lista inteira. */
  const substituir = (novo: UsuarioDaLista) => {
    if (!data) return
    lista.setData({
      ...data,
      itens: data.itens.map((u) => (u.id === novo.id ? novo : u)),
    })
  }

  const agir = async (id: string, fn: () => Promise<UsuarioDaLista>) => {
    setErroAcao(null)
    setSalvando(id)
    try {
      substituir(await fn())
    } catch (e) {
      setErroAcao(errorMessage(e))
    } finally {
      setSalvando(null)
      setConfirmando(null)
    }
  }

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <AbasDeConfig />

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Users</h1>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Everyone who signed up. Promote someone to Manager, or turn an account
          off — disabling takes effect on that person's very next request.
        </p>
      </header>

      {/*
        **A explicação de onde vem o Admin fica na tela, e não só no card.**
        Sem ela, a ausência do botão "make admin" parece um controle que
        alguém esqueceu de implementar.
      */}
      <p
        className="mb-6 rounded-lg border p-4 text-sm leading-relaxed"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}
      >
        Admin is not granted here: it comes from the <code>ADMIN_EMAILS</code>{' '}
        variable on the server, re-checked at every sign-in. A button on this
        page would create a second source of truth that the next sign-in undoes.
      </p>

      <div className="mb-5">
        <label
          htmlFor={buscaId}
          className="mb-1.5 block text-sm font-medium"
        >
          Search by name or email
        </label>
        <input
          id={buscaId}
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="name or email…"
          className="min-h-11 w-full rounded-md border px-3 text-sm sm:max-w-md"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
          }}
        />
      </div>

      {erroAcao && (
        // `role="alert"` porque é resposta a um gesto. Borda + texto, nunca
        // só cor.
        <p
          role="alert"
          className="mb-5 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: WARN_INK, color: WARN_INK }}
        >
          {erroAcao}
        </p>
      )}

      {lista.loading && <LoadingState label="Loading users…" />}
      {lista.error && <ErrorState message={lista.error} onRetry={lista.reload} />}

      {data && data.itens.length === 0 && (
        <EmptyState
          message={
            termo
              ? `No user matches “${termo}”.`
              : 'Nobody has signed up yet.'
          }
        />
      )}

      {data && data.itens.length > 0 && (
        <>
          {/*
            **A tabela rola dentro do próprio container**, e não empurra a
            página: seis colunas não cabem em 390px, e o body do app nunca
            pode ganhar rolagem horizontal.
          */}
          <div
            className="overflow-x-auto rounded-lg border"
            style={{ borderColor: 'var(--border)' }}
          >
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">
                Registered users, with role, sign-up date and last sign-in
              </caption>
              <thead>
                <tr style={{ background: 'var(--surface-sunken)' }}>
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  <Th>Last seen</Th>
                  <Th>Status</Th>
                  {/*
                    O cabeçalho da coluna de ações não é visível, mas o leitor
                    de tela precisa de um nome para anunciar a célula.

                    ⚠️ **É `aria-label` na `<th>`, e não um `<span
                    className="sr-only">` dentro dela.** O `sr-only` do
                    Tailwind é `position:absolute`, e numa `<th>` — que não
                    cria bloco contido — ele se posiciona contra o bloco
                    inicial, na borda direita da TABELA. Medido em 390px: o
                    span nascia em `right=746` e dava rolagem horizontal à
                    página inteira, apesar de a tabela já rolar dentro do seu
                    container. Um elemento de 1px invisível empurrando o body.
                  */}
                  <Th rotulo="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.itens.map((u) => (
                  <Linha
                    key={u.id}
                    u={u}
                    salvando={salvando === u.id}
                    confirmando={confirmando === u.id}
                    onConfirmar={() => {
                      setErroAcao(null)
                      setConfirmando(u.id)
                    }}
                    onCancelar={() => setConfirmando(null)}
                    onPapel={(role) =>
                      void agir(u.id, () => api.mudarPapel(u.id, role))
                    }
                    onAtivo={(active) =>
                      void agir(u.id, () => api.mudarAtivo(u.id, active))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/*
            A `Paginacao` é a mesma da tela de vagas — 25 por página, e a
            mesma janela de números. Com dez usuários uma lista bastaria, mas
            sem ela ninguém acha ninguém depois.

            Sem `onMais`: aqui não há o que buscar no servidor sob demanda, a
            lista inteira já está no banco. O botão nem aparece.
          */}
          <Paginacao
            atual={data.pagina}
            paginas={data.paginas}
            total={data.total}
            onIr={(p) => setPagina(Math.min(Math.max(1, p), data.paginas))}
          />
        </>
      )}
    </main>
  )
}

/**
 * Uma célula de cabeçalho.
 *
 * `rotulo` é para a coluna que não mostra título mas precisa de nome
 * acessível — ver o comentário na coluna de ações.
 */
function Th({
  children,
  rotulo,
}: {
  children?: React.ReactNode
  rotulo?: string
}) {
  return (
    <th
      scope="col"
      aria-label={rotulo}
      className="border-b px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      {children}
    </th>
  )
}

function Linha({
  u,
  salvando,
  confirmando,
  onConfirmar,
  onCancelar,
  onPapel,
  onAtivo,
}: {
  u: UsuarioDaLista
  salvando: boolean
  confirmando: boolean
  onConfirmar: () => void
  onCancelar: () => void
  onPapel: (role: string) => void
  onAtivo: (active: boolean) => void
}) {
  const papelId = useId()
  const inicial = u.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <tr
      className="border-b last:border-b-0"
      style={{
        borderColor: 'var(--border)',
        // A conta desligada fica esmaecida, mas a coluna Status diz "Disabled"
        // por escrito: opacidade sozinha é diferença só de cor.
        opacity: u.active ? 1 : 0.65,
      }}
    >
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-sunken)',
            }}
          >
            {u.avatarUrl ? (
              <img src={u.avatarUrl} alt="" aria-hidden className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {inicial}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">
              {u.name}
              {u.isSelf && (
                <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  (you)
                </span>
              )}
            </span>
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
              {u.email}
            </span>
          </span>
        </div>
      </td>

      <td className="px-3 py-3">
        {u.canChangeRole ? (
          <>
            {/*
              O rótulo carrega o NOME da pessoa ("Role for Ana Silva"). Sem
              isso o leitor de tela anuncia "Role, Role, Role" numa lista de
              vinte e cinco — a mesma razão do rótulo das linhas do Invoice.
            */}
            <label htmlFor={papelId} className="sr-only">
              Role for {u.name}
            </label>
            <select
              id={papelId}
              value={u.role}
              disabled={salvando}
              onChange={(e) => onPapel(e.target.value)}
              className="min-h-9 rounded-md border px-2 text-sm disabled:opacity-60"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              {/* Não há opção ADMIN, e é o ponto: ela viria do ADMIN_EMAILS. */}
              <option value="COMMON_USER">User</option>
              <option value="MANAGER">Manager</option>
            </select>
          </>
        ) : (
          <Papel role={u.role} />
        )}
      </td>

      <td className="px-3 py-3 whitespace-nowrap">
        <Data iso={u.createdAt} vazio="Unknown" />
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <Data iso={u.lastLoginAt} vazio="Never signed in" />
      </td>

      <td className="px-3 py-3">
        {u.active ? (
          <span style={{ color: 'var(--text-muted)' }}>Active</span>
        ) : (
          <span>
            <span style={{ color: WARN_INK }}>Disabled</span>
            {/*
              **Quem desligou, e quando.** Sem isto uma conta desligada é um
              mistério: o dono vê a conta fora e não sabe se foi ele, um
              manager, ou um engano.
            */}
            {u.deactivatedByName && (
              <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                by {u.deactivatedByName}
                {u.deactivatedAt && (
                  <>
                    {' · '}
                    <Data iso={u.deactivatedAt} vazio="" />
                  </>
                )}
              </span>
            )}
          </span>
        )}
      </td>

      <td className="px-3 py-3 text-right">
        {!u.canToggleActive ? null : u.active ? (
          confirmando ? (
            /*
              **A confirmação vive na própria linha, e não num modal.** O
              efeito é imediato — a sessão da pessoa cai na requisição
              seguinte —, e a pergunta precisa estar ao lado da conta de que
              se fala. Um diálogo genérico ("Are you sure?") longe da linha é
              exatamente como se desliga a pessoa errada.
            */
            <span className="flex items-center justify-end gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Sign them out now?
              </span>
              <button
                type="button"
                onClick={() => onAtivo(false)}
                disabled={salvando}
                className="min-h-9 rounded-md border px-3 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: WARN_INK, color: WARN_INK }}
              >
                {salvando ? 'Disabling…' : 'Disable'}
              </button>
              <button
                type="button"
                onClick={onCancelar}
                className="min-h-9 rounded-md border px-3 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onConfirmar}
              className="min-h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Disable
            </button>
          )
        ) : (
          /*
            Reativar NÃO pede confirmação: devolver o acesso a alguém é
            reversível pelo mesmo botão, e o gesto não tira ninguém do produto.
          */
          <button
            type="button"
            onClick={() => onAtivo(true)}
            disabled={salvando}
            className="min-h-9 rounded-md border px-3 text-sm disabled:opacity-60"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            {salvando ? 'Enabling…' : 'Enable'}
          </button>
        )}
      </td>
    </tr>
  )
}
