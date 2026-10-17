import { statusSchema } from '#shared/contracts'
import { setStatus } from '../../../core/feedback'
import { requireOwner } from '../../../utils/auth'
import { collatasDatabase } from '../../../utils/collatas'

export default defineEventHandler(async (event) => {
  requireOwner(event)
  const body = statusSchema.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, statusMessage: 'Unknown status.' })
  if (!setStatus(collatasDatabase(), getRouterParam(event, 'id') ?? '', body.data.status))
    throw createError({ statusCode: 404, statusMessage: 'This feedback is gone.' })
  return body.data
})
