interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 py-16 justify-center text-sm"
      style={{ color: 'var(--text-muted)' }}
      role="status"
    >
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="rounded-lg border p-6 text-center"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface-sunken)',
      }}
      role="alert"
    >
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--brand)', color: 'var(--brand-text)' }}
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
      {message}
    </p>
  )
}
