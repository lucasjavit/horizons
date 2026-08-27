import { Link, useLocation } from 'react-router-dom'

/**
 * A barra de abas de Configurações.
 *
 * **Não é aba da navegação principal.** Tracks, Jobs, Saved e Invoice são
 * produto, para todo mundo; isto é administração atrás da engrenagem, que já
 * não aparece para usuário comum. Pôr "AI providers" ao lado de "Invoice"
 * ofereceria a quem não é admin um caminho que só daria 403.
 *
 * Rola na horizontal em tela estreita, como a `Abas` do `App.tsx`: cinco
 * rótulos não cabem em 390px, e a rolagem fica DENTRO da nav em vez de
 * empurrar a página inteira.
 */
export function AbasDeConfig() {
  const { pathname } = useLocation()

  const abas = [
    { to: '/config/ia', label: 'AI providers' },
    { to: '/config/vagas', label: 'Job sources' },
    { to: '/config/notificacoes', label: 'Notifications' },
    { to: '/config/deploy', label: 'Going live' },
    { to: '/config', label: 'Features' },
  ]

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
