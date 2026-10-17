import type { FeedbackPage } from '#shared/contracts'
import { feedbackPage } from '../../core/feedback'
import { requireOwner } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'
import { inboxFilter } from '../../utils/inbox'

const PAGE_SIZE = 50

export default defineEventHandler((event): FeedbackPage => {
  requireOwner(event)
  const query = getQuery(event)
  const app = typeof query.app === 'string' && query.app ? query.app : undefined
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(query.page)) || 1))
  return feedbackPage(collatasDatabase(), {
    app,
    filter: inboxFilter(event),
    page,
    pageSize: PAGE_SIZE,
  })
})
