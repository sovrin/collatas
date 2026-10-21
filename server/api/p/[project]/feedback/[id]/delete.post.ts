import { deleteFeedback } from '../../../../../core/feedback'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { announceChange } from '#nexitas/server/utils/changes'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!deleteFeedback(nexitasDatabase(), requestProject(event).id, id))
    throw createError({ statusCode: 404, statusMessage: 'This feedback is gone.' })
  announceChange()
  return { ok: true }
})
