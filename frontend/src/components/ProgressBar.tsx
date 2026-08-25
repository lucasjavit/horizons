interface ProgressBarProps {
  completed: number
  total: number
  /** Mostra "3 de 12 aulas · 25%" acima da barra. */
  showLabel?: boolean
}

/** Barra de progresso: dourado (--accent) sobre trilho verde escuro. */
export function ProgressBar({ completed, total, showLabel }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span style={{ color: 'var(--text-muted)' }}>
            {completed} of {total} {total === 1 ? 'lesson' : 'lessons'}
          </span>
          <span className="font-semibold" style={{ color: 'var(--accent-ink)' }}>
            {percent}%
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--brand)' }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% complete`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${percent}%`, background: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
