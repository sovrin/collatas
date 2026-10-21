import { deleteApp } from '../../../../../core/apps'
import { projectApp } from '../../../../../utils/collatas'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'

export default defineEventHandler((event) => {
  deleteApp(nexitasDatabase(), projectApp(event).id)
  announceChange()
  return { ok: true }
})
