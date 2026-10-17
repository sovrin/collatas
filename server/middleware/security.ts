import type { H3Event } from 'h3'
import { getApp } from '../core/apps'
import { collatasDatabase, collatasOrigin } from '../utils/collatas'

// Two kinds of API live here. /api/* is the admin's: only collatas' own pages may write to it.
// /v1/apps/<id>/* is public on purpose: the sites registered for that app may call it from the
// browser, so it answers CORS for exactly those origins and refuses everyone else.
const PUBLIC = /^\/v1\/apps\/([a-z0-9-]+)\/(form|feedback)$/
// Feedback and app settings are a few kB. Checked here, not left to whichever proxy is in front.
const MAX_BODY = 64 * 1024

export default defineEventHandler((event) => {
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'same-origin')
  // shortcut: no script-src, since Nuxt inlines its config script; add nonces if pages ever
  // render HTML from feedback.
  setHeader(
    event,
    'Content-Security-Policy',
    "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  )
  if (!['GET', 'HEAD', 'OPTIONS'].includes(event.method)) limitBody(event)
  const path = event.path.split('?')[0]!
  const route = PUBLIC.exec(path)
  if (route) return publicApi(event, route[1]!)
  if (!path.startsWith('/api/')) return
  setHeader(event, 'Cache-Control', 'no-store')
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  // Compare with a configured origin, never with caller-controlled forwarded headers.
  if (getHeader(event, 'origin') !== collatasOrigin()) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This request did not come from collatas.',
    })
  }
  if (
    event.method !== 'DELETE' &&
    !getHeader(event, 'content-type')?.startsWith('application/json')
  ) {
    throw createError({ statusCode: 415, statusMessage: 'Send application/json.' })
  }
})

/** A body must announce its length, and stay under MAX_BODY. Browsers always send the length for
 *  these requests; a body without one (chunked) could grow without end before it is read. */
function limitBody(event: H3Event) {
  const length = Number(getHeader(event, 'content-length') ?? Number.NaN)
  if (Number.isNaN(length))
    throw createError({ statusCode: 411, statusMessage: 'Send the body with a Content-Length.' })
  if (length > MAX_BODY)
    throw createError({ statusCode: 413, statusMessage: 'This request is too large.' })
}

function publicApi(event: H3Event, id: string) {
  setHeader(event, 'Cache-Control', 'no-store')
  const origin = getHeader(event, 'origin')
  const app = getApp(collatasDatabase(), id)
  // A browser always sends Origin on these cross-site requests; without a match there is no
  // CORS header, so a page elsewhere cannot read the answer either.
  if (!app?.enabled || !origin || !app.origins.includes(origin)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This site may not send feedback to this app.',
    })
  }
  setHeaders(event, { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' })
  if (event.method === 'OPTIONS') {
    setHeaders(event, {
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '600',
    })
    setResponseStatus(event, 204)
    return ''
  }
}
