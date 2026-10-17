export function formatTime(value: number | null) {
  if (!value) return '—'
  return (
    new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      // Seconds, so operations started in the same minute stay distinguishable.
      second: '2-digit',
      timeZone: 'UTC',
    }).format(value) + ' UTC'
  )
}

/** "5 min ago", "2 h ago", "3 d ago"; older than a week shows the date. Minute-grained, so the
 *  server render and the hydrated page agree. */
export function formatAge(value: number | null, now = Date.now()) {
  if (!value) return '—'
  const minutes = Math.floor((now - value) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))} d ago`
  return formatTime(value)
}

export function errorMessage(error: unknown) {
  const response = error as { data?: { statusMessage?: string } }
  return response?.data?.statusMessage || 'Could not reach collatas. Please try again.'
}
