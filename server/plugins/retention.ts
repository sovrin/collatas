import { pruneFeedback } from '../core/feedback'
import { collatasDatabase } from '../utils/collatas'

// Done and spam feedback leaves after its app's retention: checked at start and every hour.
export default defineNitroPlugin(() => {
  const prune = () => {
    const removed = pruneFeedback(collatasDatabase())
    if (removed) console.info(`collatas: deleted ${removed} done or spam entries past retention`)
  }
  prune()
  setInterval(prune, 60 * 60 * 1000).unref()
})
