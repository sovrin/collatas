import { pruneAttempts } from '../core/auth'
import { pruneFeedback } from '../core/feedback'
import { collatasDatabase } from '../utils/collatas'
import { announceChange } from '../utils/changes'

// Feedback leaves after its app's retention, and rate limits once their window ends: checked at
// start and every hour.
export default defineNitroPlugin(() => {
  const prune = () => {
    pruneAttempts(collatasDatabase())
    const removed = pruneFeedback(collatasDatabase())
    if (!removed) return
    console.info(`collatas: deleted ${removed} entries past retention`)
    announceChange()
  }
  prune()
  setInterval(prune, 60 * 60 * 1000).unref()
})
