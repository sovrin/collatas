import { listApps } from '../core/apps'
import { countNew } from '../core/feedback'
import { requireOwner } from '../utils/auth'
import { collatasDatabase } from '../utils/collatas'

/** The status line under every page: new feedback, and how many apps send it. */
export default defineEventHandler((event) => {
  requireOwner(event)
  const db = collatasDatabase()
  return { newCount: countNew(db), appCount: listApps(db).length }
})
