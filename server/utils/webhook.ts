// Tells something outside collatas (ntfy, n8n, a script) about new feedback. The payload is a
// contract like /v1: fields are only added, never renamed or removed.
import { createHmac } from 'node:crypto'
import type { Accepted } from '../core/feedback'
import type { Submission } from '../../shared/contracts'
import { nexitasOrigin } from '#nexitas/server/utils/nexitas'

/** Posts new feedback to COLLATAS_WEBHOOK_URL, if set. Never awaited: the visitor's answer
 *  does not wait on the receiver, and a failed delivery is logged, not retried. */
export function sendFeedbackWebhook(
  app: { id: string; name: string; projectId: string },
  id: string,
  submission: Submission,
  { context, page }: Accepted,
) {
  const url = process.env.COLLATAS_WEBHOOK_URL
  if (!url) return
  // The email stays out: whoever runs the receiver needn't learn who wrote.
  const payload = {
    event: 'feedback.new',
    id,
    app: { id: app.id, name: app.name },
    kind: submission.kind,
    message: submission.message,
    context,
    page,
    url: `${nexitasOrigin()}/p/${app.projectId}/feedback/${id}`,
  }
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  // With a shared secret the receiver can tell collatas' posts from anyone else's.
  const secret = process.env.COLLATAS_WEBHOOK_SECRET
  if (secret)
    headers['x-collatas-signature'] =
      `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) console.warn(`Webhook answered ${response.status}.`)
    })
    .catch((error: Error) => console.warn(`Webhook failed: ${error.message}`))
}
