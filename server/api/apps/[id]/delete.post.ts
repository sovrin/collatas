import { deleteApp } from '../../../core/apps'
import { requireOwner, routeApp } from '../../../utils/auth'
import { collatasDatabase } from '../../../utils/collatas'

export default defineEventHandler((event) => {
  requireOwner(event)
  deleteApp(collatasDatabase(), routeApp(event).id)
  return { ok: true }
})
