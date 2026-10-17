import type { InboxGroup } from '#shared/contracts'
import { inboxOverview } from '../core/feedback'
import { requireOwner } from '../utils/auth'
import { collatasDatabase } from '../utils/collatas'
import { inboxFilter, inboxSearch } from '../utils/inbox'

// Across all apps, each shows its newest few; its own page lists the rest.
const PER_APP = 5

export default defineEventHandler((event): InboxGroup[] => {
  requireOwner(event)
  return inboxOverview(collatasDatabase(), inboxFilter(event), PER_APP, inboxSearch(event))
})
