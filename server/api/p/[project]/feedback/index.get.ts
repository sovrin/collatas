import type { FeedbackPage } from '../../../../../shared/contracts'
import { getProjectApp } from '../../../../core/apps'
import { feedbackPage } from '../../../../core/feedback'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { inboxFilter, inboxSearch } from '../../../../utils/inbox'

const PAGE_SIZE = 50

// The project's feedback, a page at a time.
export default defineEventHandler((event): FeedbackPage => {
  const page = Math.max(1, Math.min(10_000, Math.floor(Number(getQuery(event).page)) || 1))
  const db = nexitasDatabase()
  const app = getProjectApp(db, requestProject(event).id)
  // A project that collects no feedback has none to show.
  if (!app) return { items: [], total: 0, newCount: 0, page, pageSize: PAGE_SIZE }
  return feedbackPage(db, {
    app: app.id,
    filter: inboxFilter(event),
    page,
    pageSize: PAGE_SIZE,
    search: inboxSearch(event),
  })
})
