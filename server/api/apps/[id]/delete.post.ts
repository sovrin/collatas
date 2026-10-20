import { deleteApp } from '../../../core/apps'
import { routeApp } from '../../../utils/collatas'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'

export default defineEventHandler((event) => {
  deleteApp(nexitasDatabase(), routeApp(event).id)
  announceChange()
  return { ok: true }
})
