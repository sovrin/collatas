import { deleteFeedback } from '../../../core/feedback'
import { requireOwner } from '../../../utils/auth'
import { collatasDatabase } from '../../../utils/collatas'
import { announceChange } from '../../../utils/changes'

export default defineEventHandler((event) => {
  requireOwner(event)
  deleteFeedback(collatasDatabase(), getRouterParam(event, 'id') ?? '')
  announceChange()
  return { ok: true }
})
