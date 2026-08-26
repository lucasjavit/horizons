import { Link } from 'react-router-dom'
import { usePopover } from '../../lib/usePopover'
import { useTema } from '../../lib/tema'
import { SeletorDeLocal } from './SeletorDeLocal'
import { SinoDeAvisos } from './SinoDeAvisos'

/**
 * A barra de busca do topo da tela de vagas.
 *
 * Da esquerda para a direita: seletor de local, campo de texto, `×` para
 * limpar, botão de filtros com o número de filtros ativos, sino, tema e menu.
 *
 * **O campo de texto substitui o dropdown "Job title"**, e a diferença não é
 * cosmética: o dropdown oferecia uma lista fixa escrita à mão, e o campo aceita
 * qualquer coisa — "Java software engineer LATAM" não existia na lista, e é
 * exatamente o que alguém digita.
 */
export function BarraDeBusca({
  texto,
  onTexto,
  formatos,
  regioes,
  onLocal,
  quantosFiltros,
  onAbrirFiltros,
  onBuscar,
}: {
  texto: string
  onTexto: (t: string) => void
  formatos: string[]
  regioes: string[]
  onLocal: (formatos: string[], regioes: string[]) => void
  /** Quantos filtros do modal estão ativos — o badge verde da referência. */
  quantosFiltros: number
  onAbrirFiltros: () => void
  /**
   * Dispara a busca.
   *
   * **Recebe o texto por parâmetro, e não o lê do estado.** O `×` limpa e
   * busca no mesmo clique, e `setState` só agenda: chamar `onBuscar()` na
   * linha seguinte ao `onTexto('')` fazia a busca sair com o texto ANTIGO
   * (QA, 26/08) — campo vazio e lista filtrada, um estado que a tela afirma
   * não existir. Passar o valor mata a closure velha na origem.
   */
  onBuscar: (texto: string) => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-xl border px-2 py-1.5 sm:flex-nowrap"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
    >
      <SeletorDeLocal formatos={formatos} regioes={regioes} onMudar={onLocal} />

      <div
        aria-hidden
        className="hidden h-6 w-px shrink-0 sm:block"
        style={{ background: 'var(--border)' }}
      />

      {/* O campo é um `form` para que Enter busque — sem isso, quem digita e
          aperta Enter não vê nada acontecer, e o teclado é como se pesquisa. */}
      <form
        className="flex min-w-0 flex-1 items-center gap-2 px-2"
        onSubmit={(e) => {
          e.preventDefault()
          onBuscar(texto)
        }}
      >
        <SearchIcon />
        <label htmlFor="busca-de-vagas" className="sr-only">
          Search jobs and companies
        </label>
        <input
          id="busca-de-vagas"
          type="search"
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          placeholder="Search jobs and companies…"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
          style={{ color: 'var(--text)' }}
        />
        {texto.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onTexto('')
              // Limpar já busca de novo: o `×` promete voltar ao estado sem
              // texto, e deixar a lista antiga na tela contradiz isso.
              // A string vazia vai explícita — ver a nota em `onBuscar`.
              onBuscar('')
            }}
            aria-label="Clear search"
            className="h-7 w-7 shrink-0 rounded-md text-base leading-none"
            style={{ color: 'var(--text-muted)' }}
          >
            <span aria-hidden>×</span>
          </button>
        )}
      </form>

      <button
        type="button"
        onClick={onAbrirFiltros}
        aria-label={
          quantosFiltros > 0
            ? `All filters, ${quantosFiltros} active`
            : 'All filters'
        }
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"
        style={{ color: 'var(--text)' }}
      >
        <FiltersIcon />
        {quantosFiltros > 0 && (
          <span
            className="rounded px-1.5 text-xs tabular-nums"
            style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
          >
            {quantosFiltros}
          </span>
        )}
      </button>

      <div
        aria-hidden
        className="hidden h-6 w-px shrink-0 sm:block"
        style={{ background: 'var(--border)' }}
      />

      <SinoDeAvisos />
      <BotaoDeTema />
      <MenuDaConta />
    </div>
  )
}

/**
 * O alternador de tema.
 *
 * Cicla `sistema → claro → escuro`. O rótulo diz o estado ATUAL e o próximo
 * passo, porque um ícone de lua sozinho é ambíguo: significa "está escuro" ou
 * "clique para escurecer"?
 */
function BotaoDeTema() {
  const { tema, alternar } = useTema()
  const proximo = tema === 'sistema' ? 'light' : tema === 'claro' ? 'dark' : 'system'
  const atual = tema === 'sistema' ? 'system' : tema === 'claro' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={`Theme: ${atual}. Switch to ${proximo}.`}
      title={`Theme: ${atual}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
      style={{ color: 'var(--text-muted)' }}
    >
      {tema === 'claro' ? <SunIcon /> : tema === 'escuro' ? <MoonIcon /> : <AutoIcon />}
    </button>
  )
}

/**
 * O menu hambúrguer: Profile, Settings, Saved jobs.
 *
 * As três rotas já existem — o menu só as junta num lugar. `Saved jobs` leva a
 * `/salvas` (JOB-05) e `Settings` a `/config`.
 */
function MenuDaConta() {
  const { aberto, setAberto, alternar, caixa, gatilho } = usePopover()

  // **`Profile` aponta para `/vagas`, e não para uma rota própria.**
  //
  // Não existe página de perfil: o perfil de busca é a caixa de currículo mais
  // os filtros, e eles vivem na própria tela de vagas (JOB-02). Criar
  // `/vagas/perfil` só para o menu ter três itens daria um link para uma tela
  // vazia — e o menu prometeria uma página que ninguém escreveu.
  const itens = [
    { para: '/vagas', rotulo: 'Profile' },
    { para: '/salvas', rotulo: 'Saved jobs' },
    { para: '/config', rotulo: 'Settings' },
  ]

  return (
    <div ref={caixa} className="relative">
      <button
        ref={gatilho}
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label="Menu"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ color: 'var(--text-muted)' }}
      >
        <MenuIcon />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border py-1 shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {itens.map((i) => (
            <Link
              key={i.para}
              to={i.para}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="block px-4 py-2.5 text-sm hover:underline"
              style={{ color: 'var(--text)' }}
            >
              {i.rotulo}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// Os ícones são SVG e não emoji: **esta máquina não tem fonte de emoji**, e o
// glifo vira quadrado vazio (medido no JOB-04, que tirou 🔍 e ✕ dos botões).

function SearchIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0"
      style={{ color: 'var(--text-muted)' }}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function FiltersIcon() {
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
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

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

function MenuIcon() {
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
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
