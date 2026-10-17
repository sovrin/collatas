import { appConfigSchema } from '#shared/contracts'
import { createApp } from '../../core/apps'
import { requireOwner } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'
import { invalid } from '../../utils/invalid'

export default defineEventHandler(async (event) => {
  requireOwner(event)
  const body = appConfigSchema.safeParse(await readBody(event))
  if (!body.success) throw invalid(body.error)
  if (!createApp(collatasDatabase(), body.data))
    throw createError({ statusCode: 409, statusMessage: 'An app with this id exists already.' })
  setResponseStatus(event, 201)
  return body.data
})
