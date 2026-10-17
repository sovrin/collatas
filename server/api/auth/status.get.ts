import type { AuthStatus } from '#shared/contracts'
import { getOwner, sessionOwner } from '../../core/auth'
import { SESSION_COOKIE } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'

export default defineEventHandler((event): AuthStatus => {
  const db = collatasDatabase()
  return { setupRequired: !getOwner(db), owner: sessionOwner(db, getCookie(event, SESSION_COOKIE)) }
})
