import { appSettingsSchema } from '../../../shared/contracts'
import { getApp, updateApp } from '../../core/apps'
import { routeApp } from '../../utils/collatas'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

export default defineEventHandler(async (event) => {
  const app = routeApp(event)
  const body = appSettingsSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  updateApp(db, app.id, body.data)
  announceChange()
  return getApp(db, app.id)
})
