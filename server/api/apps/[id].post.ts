import { appConfigSchema } from '#shared/contracts'
import { updateApp } from '../../core/apps'
import { requireOwner, routeApp } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'
import { announceChange } from '../../utils/changes'
import { invalid } from '../../utils/invalid'

export default defineEventHandler(async (event) => {
  requireOwner(event)
  const app = routeApp(event)
  const body = appConfigSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  if (body.data.id !== app.id)
    throw createError({ statusCode: 400, statusMessage: 'An app keeps its id.' })
  updateApp(collatasDatabase(), app.id, body.data)
  announceChange()
  return body.data
})
