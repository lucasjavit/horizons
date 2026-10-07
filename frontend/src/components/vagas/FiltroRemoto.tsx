import type { RemotoDoPais } from './remoto-do-pais'

/**
 * O controle "Only jobs I can do from <país>" e o aviso de país ausente
 * (JOB-55). Não renderiza nada quando a verificação está inativa — a tela
 * volta a ser a de antes do card, sem espaço vazio nem erro.
 */
export function FiltroRemoto({
  remoto,
  ligado,
  onAlternar,
  resumo,
}: {
  remoto: RemotoDoPais
  ligado: boolean
  onAlternar: (ligado: boolean) => void
  /** Só da página visível: é o que foi verificado. */
  resumo: { sim: number; nao: number; semResposta: number }
}) {
  if (remoto.estado === 'sem_pais') {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Want to know which of these jobs you can do remotely from where you live?{' '}
        <a href="/perfil" className="font-medium underline" style={{ color: 'var(--accent-ink)' }}>
          Set your country in your profile
        </a>{' '}
        and each job gets checked against its ad.
      </p>
    )
  }
  if (remoto.estado !== 'ok' || !remoto.pais) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-6 items-center gap-2">
        <input
          id="filtro-remoto"
          type="checkbox"
          checked={ligado}
          onChange={(e) => onAlternar(e.target.checked)}
          aria-describedby="filtro-remoto-resumo"
          className="h-4 w-4"
        />
        <label htmlFor="filtro-remoto" className="text-sm">
          Only jobs I can do from {remoto.pais}
        </label>
      </div>
      {/* `aria-live`: o número muda sozinho quando os vereditos chegam, e
          quem não vê a tela precisa saber que a lista encolheu. */}
      <p id="filtro-remoto-resumo" aria-live="polite" className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {remoto.verificando
          ? 'Reading the ads on this page…'
          : ligado
            ? `Showing ${resumo.sim} on this page. Hidden: ${resumo.nao} not open to ${remoto.pais}, and ${resumo.semResposta} with no answer — the ad does not say, or it could not be checked.`
            : `On this page: ${resumo.sim} can be done from ${remoto.pais}, ${resumo.nao} cannot, ${resumo.semResposta} with no answer. AI reads each ad and quotes the sentence it relied on.`}
      </p>
    </div>
  )
}
