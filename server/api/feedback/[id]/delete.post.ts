import { deleteFeedback } from '../../../core/feedback'
import { requireOwner } from '../../../utils/auth'
import { collatasDatabase } from '../../../utils/collatas'

export default defineEventHandler((event) => {
  requireOwner(event)
  deleteFeedback(collatasDatabase(), getRouterParam(event, 'id') ?? '')
  return { ok: true }
})
