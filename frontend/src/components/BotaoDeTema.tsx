import { useTema } from '../lib/tema'

/**
 * O alternador de tema, no cabeçalho do site.
 *
 * Ficava na barra de busca da tela de Jobs (26/08), onde só existia para quem
 * chegava naquela tela — e o tema vale para o app inteiro, inclusive nas
 * trilhas e no invoice. No cabeçalho ele acompanha a navegação, que é onde as
 * escolhas de aplicação já moram.
 *
 * Cicla `sistema → claro → escuro`. O rótulo diz o estado ATUAL **e** o
 * próximo passo, porque um ícone de lua sozinho é ambíguo: significa "está
 * escuro" ou "clique para escurecer"?
 */
export function BotaoDeTema() {
  const { tema, alternar } = useTema()
  const proximo = tema === 'sistema' ? 'light' : tema === 'claro' ? 'dark' : 'system'
  const atual = tema === 'sistema' ? 'system' : tema === 'claro' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Theme: ${atual}. Switch to ${proximo}.`}
      title={`Theme: ${atual}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] hover:text-[var(--brand)] active:bg-[color-mix(in_srgb,var(--brand)_26%,transparent)]"
      style={{ color: 'var(--text-muted)' }}
    >
      {tema === 'claro' ? <SunIcon /> : tema === 'escuro' ? <MoonIcon /> : <AutoIcon />}
    </button>
  )
}

// SVG e não emoji: **esta máquina não tem fonte de emoji**, e o glifo vira
// quadrado vazio (medido no JOB-04).

function MoonIcon() {
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
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8" />
    </svg>
  )
}

function SunIcon() {
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
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

/** Meia lua, meio sol: o tema segue o sistema. */
function AutoIcon() {
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
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  )
}
