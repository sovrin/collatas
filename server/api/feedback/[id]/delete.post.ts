import { deleteFeedback } from '../../../core/feedback'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { announceChange } from '#nexitas/server/utils/changes'

export default defineEventHandler((event) => {
  deleteFeedback(nexitasDatabase(), getRouterParam(event, 'id') ?? '')
  announceChange()
  return { ok: true }
})
