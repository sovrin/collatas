import type { H3Event } from 'h3'
import { STATUSES, searchSchema } from '../../shared/contracts'
import type { InboxFilter } from '../core/feedback'

const FILTERS: readonly string[] = ['open', 'all', ...STATUSES]

/** The inbox filter from the query; anything unknown is the default, open. */
export function inboxFilter(event: H3Event): InboxFilter {
  const { filter } = getQuery(event)
  return (typeof filter === 'string' && FILTERS.includes(filter) ? filter : 'open') as InboxFilter
}

/** The search from the query; anything that is not a short string searches for nothing. */
export function inboxSearch(event: H3Event) {
  const parsed = searchSchema.safeParse(getQuery(event).q)
  return parsed.success ? parsed.data : ''
}
