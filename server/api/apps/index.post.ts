import { APP_DEFAULTS, newAppSchema } from '../../../shared/contracts'
import { createApp } from '../../core/apps'
import { getProject } from '#nexitas/server/core/projects'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { invalid } from '#nexitas/server/utils/invalid'

// Starts collecting feedback for a project, with the defaults; the app's page changes them.
export default defineEventHandler(async (event) => {
  const body = newAppSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  const db = nexitasDatabase()
  const { projectId } = body.data
  if (!getProject(db, projectId))
    throw createError({ statusCode: 404, statusMessage: 'There is no such project.' })
  const app = { ...APP_DEFAULTS, id: projectId, projectId }
  if (!createApp(db, app))
    throw createError({ statusCode: 409, statusMessage: 'This project collects feedback already.' })
  announceChange()
  setResponseStatus(event, 201)
  return app
})
