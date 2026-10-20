import type { InboxGroup } from '../../shared/contracts'
import { inboxOverview } from '../core/feedback'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { inboxFilter, inboxSearch } from '../utils/inbox'

// Across all apps, each shows its newest few; its own page lists the rest.
const PER_APP = 5

export default defineEventHandler((event): InboxGroup[] => {
  return inboxOverview(nexitasDatabase(), inboxFilter(event), PER_APP, inboxSearch(event))
})
