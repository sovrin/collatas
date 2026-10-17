import { deleteApp } from '../../../core/apps'
import { requireOwner, routeApp } from '../../../utils/auth'
import { collatasDatabase } from '../../../utils/collatas'
import { announceChange } from '../../../utils/changes'

export default defineEventHandler((event) => {
  requireOwner(event)
  deleteApp(collatasDatabase(), routeApp(event).id)
  announceChange()
  return { ok: true }
})
