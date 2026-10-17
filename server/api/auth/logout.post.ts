import { revokeSession } from '../../core/auth'
import { SESSION_COOKIE } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'

export default defineEventHandler((event) => {
  revokeSession(collatasDatabase(), getCookie(event, SESSION_COOKIE))
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  return { ok: true }
})
