import type { H3Event } from 'h3'
import { getApp } from '../core/apps'
import { consumeAuthAttempt, createSession, sessionOwner } from '../core/auth'
import { collatasDatabase, collatasOrigin } from './collatas'

export const SESSION_COOKIE = 'collatas_session'

export function requireOwner(event: H3Event) {
  const owner = sessionOwner(collatasDatabase(), getCookie(event, SESSION_COOKIE))
  if (!owner) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  return owner
}

export function setOwnerSession(event: H3Event) {
  const session = createSession(collatasDatabase())
  setCookie(event, SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: collatasOrigin().startsWith('https:'),
    sameSite: 'lax',
    path: '/',
    expires: new Date(session.expiresAt),
  })
}

export function checkAuthRate(event: H3Event, key: string) {
  const retryAfter = consumeAuthAttempt(collatasDatabase(), key)
  if (retryAfter) {
    setHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Try again in 15 minutes.',
    })
  }
}

/** The app named in the route, or a 404. */
export function routeApp(event: H3Event) {
  const id = getRouterParam(event, 'id') ?? ''
  const app = getApp(collatasDatabase(), id)
  if (!app) throw createError({ statusCode: 404, statusMessage: 'This app is not registered.' })
  return app
}
