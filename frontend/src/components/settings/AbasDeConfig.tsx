import { Link, useLocation } from 'react-router-dom'
import { useSessao } from '../../lib/sessao'

/**
 * A barra de abas de Configurações.
 *
 * **Não é aba da navegação principal.** Tracks, Jobs, Saved e Invoice são
 * produto, para todo mundo; isto é administração atrás da engrenagem, que já
 * não aparece para usuário comum. Pôr "AI providers" ao lado de "Invoice"
 * ofereceria a quem não é admin um caminho que só daria 403.
 *
 * Rola na horizontal em tela estreita, como a `Abas` do `App.tsx`: seis
 * rótulos não cabem em 390px, e a rolagem fica DENTRO da nav em vez de
 * empurrar a página inteira.
 */
export function AbasDeConfig() {
  const { pathname } = useLocation()
  const user = useSessao()

  /**
   * **O manager so ve a aba de Users** (PLT-11).
   *
   * As outras cinco rotas sao `@AdminOnly()` no backend: oferece-las a ele
   * seria oferecer cinco caminhos que so dao 403. O corte do PLT-09 e
   * "Manager opera, Admin configura", e a barra desenha esse corte.
   *
   * `null` (anonimo, ou o login desligado) cai no caso completo: com
   * `AUTH_DISABLED` o backend nao checa papel nenhum, e esconder abas ali
   * esconderia a Configuracoes de quem desligou o login para mexer nela.
   */
  const soGestao = user?.role === 'MANAGER'
  // Usuario comum nao alcanca nenhuma das seis. Ele so chega aqui digitando a
  // URL — a rota responde 403 e a pagina mostra o erro —, e desenhar seis
  // caminhos mortos acima do erro convida a tentar os outros cinco.
  const semAcesso = user !== null && user.role === 'COMMON_USER'

  const abas = semAcesso
    ? []
    : soGestao
    ? [{ to: '/config/usuarios', label: 'Users' }]
    : [
        { to: '/config/ia', label: 'AI providers' },
        { to: '/config/vagas', label: 'Job sources' },
        { to: '/config/notificacoes', label: 'Notifications' },
        // Users fica ANTES de Deploy Prod: e a tela que se abre com
        // frequencia (quem se cadastrou, quem promover), enquanto o guia de
        // deploy se le uma vez por publicacao.
        { to: '/config/usuarios', label: 'Users' },
        { to: '/config/deploy', label: 'Deploy Prod' },
        { to: '/config', label: 'Features' },
      ]

  // Sem abas nao ha barra: uma borda vazia acima do erro seria so ruido.
  if (abas.length === 0) return null

  return (
    <nav
      aria-label="Settings sections"
      className="mb-7 flex min-w-0 gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ borderColor: 'var(--border)' }}
    >
      {abas.map((aba) => {
        // Comparação exata: `/config` é a aba Features, e `startsWith` faria
        // ela ficar marcada em todas as sub-rotas ao mesmo tempo.
        const ativa = pathname === aba.to
        return (
          <Link
            key={aba.to}
            to={aba.to}
            aria-current={ativa ? 'page' : undefined}
            // 44px de altura: alvo confortável, acima dos 24px da WCAG 2.5.8.
            className="flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3.5 text-sm"
            style={{
              borderBottomColor: ativa ? 'var(--brand)' : 'transparent',
              color: ativa ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: ativa ? 600 : 400,
            }}
          >
            {aba.label}
          </Link>
        )
      })}
    </nav>
  )
}
