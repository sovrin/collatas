import { createHmac } from 'node:crypto'
import type { H3Event } from 'h3'
import { nexitasDatabase, requestSender } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'
import { getApp, getProjectApp } from '../core/apps'
import { secret } from '../core/secrets'

/** Who is sending feedback, for its limits and its sender tag: the sender's network, keyed with
 *  a secret, so the database never holds an IP address. */
export function senderKey(event: H3Event) {
  return createHmac('sha256', secret(nexitasDatabase(), 'sender-key'))
    .update(requestSender(event))
    .digest('base64url')
}

/** The app named in the route, or a 404. */
export function routeApp(event: H3Event) {
  const id = getRouterParam(event, 'id') ?? ''
  const app = getApp(nexitasDatabase(), id)
  if (!app) throw createError({ statusCode: 404, statusMessage: 'This app is not registered.' })
  return app
}

/** The app of the project an /api/p/<id>/ request is for, or a 404. */
export function projectApp(event: H3Event) {
  const app = getProjectApp(nexitasDatabase(), requestProject(event).id)
  if (!app)
    throw createError({ statusCode: 404, statusMessage: 'This project collects no feedback.' })
  return app
}
