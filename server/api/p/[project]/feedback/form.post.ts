import { appSettingsSchema } from '#self/shared/contracts'
import { getApp, updateApp } from '#self/server/core/apps'
import { projectApp } from '#self/server/utils/collatas'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

export default defineEventHandler(async (event) => {
  const app = projectApp(event)
  const body = appSettingsSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  updateApp(db, app.id, body.data)
  announceChange()
  return getApp(db, app.id)
})
