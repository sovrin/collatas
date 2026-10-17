import { submissionSchema } from '#shared/contracts'
import { consumeAttempt } from '../../../../core/auth'
import { secret } from '../../../../core/database'
import { acceptSubmission, addFeedback, countLastDay } from '../../../../core/feedback'
import { checkToken } from '../../../../core/token'
import { routeApp } from '../../../../utils/auth'
import { collatasDatabase } from '../../../../utils/collatas'

const PER_SENDER = 5 // per sender and app, every 10 minutes
const PER_DAY = 200 // per app, so a flood cannot fill the disk

export default defineEventHandler(async (event) => {
  const db = collatasDatabase()
  const app = routeApp(event)
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'Send application/json.' })
  // collatas runs behind a reverse proxy that sets X-Forwarded-For; published directly, a sender
  // could set it and spread their attempts over made-up addresses.
  const sender = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const retryAfter = consumeAttempt(db, `send:${app.id}:${sender}`, PER_SENDER, 10 * 60 * 1000)
  if (retryAfter) {
    setHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'You have sent a lot of feedback just now. Try again in a few minutes.',
    })
  }
  if (countLastDay(db, app.id) >= PER_DAY)
    throw createError({
      statusCode: 429,
      statusMessage: 'This app has received a lot of feedback today. Try again tomorrow.',
    })
  const body = submissionSchema.safeParse(await readBody(event))
  if (!body.success)
    throw createError({ statusCode: 400, statusMessage: body.error.issues[0]!.message })
  // A filled honeypot is a bot: it hears success and nothing is kept.
  if (body.data.website) {
    setResponseStatus(event, 201)
    return { ok: true }
  }
  const token = checkToken(secret(db, 'form-key'), app.id, body.data.token)
  if (token === 'early')
    throw createError({ statusCode: 400, statusMessage: 'That was quick. Send it again.' })
  if (token === 'invalid')
    throw createError({
      statusCode: 400,
      statusMessage: 'The form has expired. Reload the page and send it again.',
    })
  const accepted = acceptSubmission(app, body.data)
  if ('error' in accepted) throw createError({ statusCode: 400, statusMessage: accepted.error })
  addFeedback(db, app.id, body.data, accepted.context)
  setResponseStatus(event, 201)
  return { ok: true }
})
