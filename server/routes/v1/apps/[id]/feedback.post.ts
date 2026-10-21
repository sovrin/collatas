import { submissionSchema } from '../../../../../shared/contracts'
import { consumeAttempt } from '../../../../core/limits'
import { secret } from '../../../../core/secrets'
import {
  acceptSubmission,
  addFeedback,
  appUsage,
  countLastDay,
  DAY,
  isFull,
  senderTag,
} from '../../../../core/feedback'
import { checkToken } from '../../../../core/token'
import { routeApp, senderKey } from '../../../../utils/collatas'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'
import { sendFeedbackWebhook } from '../../../../utils/webhook'

const PER_SENDER = 5 // per sender and app, every 10 minutes
const PER_SENDER_DAY = 20 // per sender and app, so one sender cannot use up PER_DAY
const PER_DAY = 200 // per app, so a flood cannot fill the disk

export default defineEventHandler(async (event) => {
  const db = nexitasDatabase()
  const app = routeApp(event)
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'Send application/json.' })
  // Every check that writes nothing comes first, so a request that would not be kept leaves no
  // trace: only a submission about to be stored counts against its sender, and rate-limit rows
  // can grow no faster than feedback itself.
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
  if (countLastDay(db, app.id) >= PER_DAY)
    throw createError({
      statusCode: 429,
      statusMessage: 'This app has received a lot of feedback today. Try again tomorrow.',
    })
  if (isFull(app, appUsage(db, app.id)))
    throw createError({
      statusCode: 507,
      statusMessage: 'This app cannot take more feedback right now.',
    })
  const sender = senderKey(event)
  const retryAfter =
    consumeAttempt(db, `send:${app.id}:${sender}`, PER_SENDER, 10 * 60 * 1000) ||
    consumeAttempt(db, `send-day:${app.id}:${sender}`, PER_SENDER_DAY, DAY)
  if (retryAfter) {
    setHeader(event, 'Retry-After', retryAfter)
    throw createError({
      statusCode: 429,
      statusMessage: 'You have sent a lot of feedback. Try again later.',
    })
  }
  const id = addFeedback(db, app.id, body.data, {
    ...accepted,
    sender: senderTag(db, app.id, sender),
  })
  announceChange()
  sendFeedbackWebhook(app, id, body.data, accepted)
  setResponseStatus(event, 201)
  return { ok: true }
})
