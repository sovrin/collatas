import { KIND_LABELS, type FormRules } from '../../../../../shared/contracts'
import { secret } from '../../../../core/secrets'
import { issueToken } from '../../../../core/token'
import { routeApp } from '../../../../utils/collatas'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'

// What the form component renders, and a token it must send back. The security middleware has
// already checked that the calling site is one of this app's origins.
export default defineEventHandler((event): FormRules => {
  const app = routeApp(event)
  return {
    app: app.id,
    name: app.name,
    kinds: app.kinds.map((value) => ({ value, label: KIND_LABELS[value] })),
    maxMessage: app.maxMessage,
    context: app.context,
    sendPage: app.sendPage,
    token: issueToken(secret(nexitasDatabase(), 'form-key'), app.id),
  }
})
