export function formatTime(value: number | null) {
  if (!value) return '—'
  return (
    new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      // Seconds, so entries sent in the same minute stay distinguishable.
      second: '2-digit',
      timeZone: 'UTC',
    }).format(value) + ' UTC'
  )
}

/** "5 min ago", "2 h ago", "3 d ago"; older than a week the day alone ("3 Jul", with the year
 *  once it is another), short enough for a row. Minute-grained and in UTC, so the server render
 *  and the hydrated page agree. */
export function formatAge(value: number | null, now = Date.now()) {
  if (!value) return '—'
  const minutes = Math.floor((now - value) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))} d ago`
  const sameYear = new Date(value).getUTCFullYear() === new Date(now).getUTCFullYear()
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(value)
}
