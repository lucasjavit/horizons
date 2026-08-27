import { Link } from 'react-router-dom'
import { usePopover } from '../../lib/usePopover'
import { HintWrap } from '../Hint'
import { BOTAO_ICONE } from './BarraDeBusca'

/**
 * O sino de notificações da barra de busca.
 *
 * **Hoje ele não tem o que mostrar, e diz isso.** As buscas salvas guardam
 * `porEmail`/`porTelegram`, mas o cron que dispara o alerta ainda não foi
 * ligado — é o JOB-42. Até lá, não há evento nenhum a listar.
 *
 * Por que o botão existe mesmo assim, em vez de ser adiado: **um popover que
 * diz "No notifications yet." é diferente de um botão inerte.** O inerte é
 * promessa vazia — a pessoa clica e nada acontece, e ela não sabe se quebrou
 * ou se está vazio. Este responde, e a resposta é a verdade.
 *
 * Sem badge de contagem, e isso é deliberado: badge só aparece quando houver
 * o que contar. Um "0" permanente ensinaria a ignorar o número justamente
 * antes de ele começar a valer.
 */
export function SinoDeAvisos() {
  const { aberto, setAberto, alternar, caixa, gatilho } = usePopover()

  return (
    <div ref={caixa} className="relative">
      <HintWrap
        title="Notifications"
        align="left"
        texto="Alerts about new jobs. Set up email and Telegram in Settings."
        suprimido={aberto}
      >
      <button
        ref={gatilho}
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className={`h-9 w-9 ${BOTAO_ICONE}`}
        style={{ color: 'var(--text-muted)' }}
      >
        <BellIcon />
      </button>
      </HintWrap>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          <p
            className="border-b px-4 py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            Notifications
          </p>

          <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No notifications yet.
          </p>

          {/*
            "View all notifications" da referência leva a uma central que não
            existe. Aqui o link vai para as notificações em Configurações —
            que é onde e-mail e Telegram são ligados, e o único lugar em que
            alguém pode fazer algo a respeito hoje.
          */}
          <Link
            to="/config/notificacoes"
            onClick={() => setAberto(false)}
            className="block border-t px-4 py-3 text-center text-sm hover:underline"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Notification settings
          </Link>
        </div>
      )}
    </div>
  )
}

/** O sino. SVG e não emoji — ver a nota do globo em `SeletorDeLocal`. */
function BellIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
