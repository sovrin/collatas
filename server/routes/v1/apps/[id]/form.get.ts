import { KIND_LABELS, MAX_MESSAGE, type FormRules } from '#shared/contracts'
import { secret } from '../../../../core/database'
import { issueToken } from '../../../../core/token'
import { routeApp } from '../../../../utils/auth'
import { collatasDatabase } from '../../../../utils/collatas'

// What the form component renders, and a token it must send back. The security middleware has
// already checked that the calling site is one of this app's origins.
export default defineEventHandler((event): FormRules => {
  const app = routeApp(event)
  return {
    app: app.id,
    name: app.name,
    kinds: app.kinds.map((value) => ({ value, label: KIND_LABELS[value] })),
    maxMessage: MAX_MESSAGE,
    context: app.context,
    sendPage: app.sendPage,
    token: issueToken(secret(collatasDatabase(), 'form-key'), app.id),
  }
})
