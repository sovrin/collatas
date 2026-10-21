import { APP_DEFAULTS } from '../../../../../../shared/contracts'
import { createApp } from '../../../../../core/apps'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { announceChange } from '#nexitas/server/utils/changes'

// Starts collecting feedback for the project, with the defaults; the form's page changes them.
export default defineEventHandler((event) => {
  const { id } = requestProject(event)
  const app = { ...APP_DEFAULTS, id, projectId: id }
  if (!createApp(nexitasDatabase(), app))
    throw createError({ statusCode: 409, statusMessage: 'This project collects feedback already.' })
  announceChange()
  setResponseStatus(event, 201)
  return app
})
