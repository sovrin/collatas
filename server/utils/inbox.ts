import type { H3Event } from 'h3'
import { STATUSES } from '#shared/contracts'
import type { InboxFilter } from '../core/feedback'

const FILTERS: readonly string[] = ['open', 'all', ...STATUSES]

/** The inbox filter from the query; anything unknown is the default, open. */
export function inboxFilter(event: H3Event): InboxFilter {
  const { filter } = getQuery(event)
  return (typeof filter === 'string' && FILTERS.includes(filter) ? filter : 'open') as InboxFilter
}
