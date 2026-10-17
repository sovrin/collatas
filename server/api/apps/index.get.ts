import { listApps } from '../../core/apps'
import { requireOwner } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'

export default defineEventHandler((event) => {
  requireOwner(event)
  return listApps(collatasDatabase())
})
