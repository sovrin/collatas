import { requireOwner } from '../utils/auth'
import { onChange } from '../utils/changes'

// The admin's live line: a server-sent event stream that says "change" whenever feedback or an
// app changes, so open pages reload what they show instead of asking every few seconds. It only
// nudges; what changed is read through the ordinary API.
export default defineEventHandler(async (event) => {
  requireOwner(event)
  // Proxies that buffer responses (nginx and friends) would hold the stream back.
  setHeader(event, 'X-Accel-Buffering', 'no')
  const stream = createEventStream(event)
  const stop = onChange(() => void stream.push({ event: 'change', data: '1' }))
  // A quiet connection is closed by many proxies after a minute or so; this keeps it open.
  const keepAlive = setInterval(() => void stream.push({ event: 'ping', data: '1' }), 25_000)
  stream.onClosed(() => {
    stop()
    clearInterval(keepAlive)
  })
  return stream.send()
})
