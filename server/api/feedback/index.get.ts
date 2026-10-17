import { STATUSES } from '#shared/contracts'
import { listFeedback, type InboxFilter } from '../../core/feedback'
import { requireOwner } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'

const FILTERS: readonly string[] = ['open', 'all', ...STATUSES]

export default defineEventHandler((event) => {
  requireOwner(event)
  const query = getQuery(event)
  const filter =
    typeof query.filter === 'string' && FILTERS.includes(query.filter) ? query.filter : 'open'
  const app = typeof query.app === 'string' && query.app ? query.app : undefined
  return listFeedback(collatasDatabase(), { app, filter: filter as InboxFilter })
})
