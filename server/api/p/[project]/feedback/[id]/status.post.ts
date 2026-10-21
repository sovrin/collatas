import { statusSchema } from '../../../../../../shared/contracts'
import { setStatus } from '../../../../../core/feedback'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { announceChange } from '#nexitas/server/utils/changes'

export default defineEventHandler(async (event) => {
  const body = statusSchema.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, statusMessage: 'Unknown status.' })
  const id = getRouterParam(event, 'id') ?? ''
  if (!setStatus(nexitasDatabase(), requestProject(event).id, id, body.data.status))
    throw createError({ statusCode: 404, statusMessage: 'This feedback is gone.' })
  announceChange()
  return body.data
})
