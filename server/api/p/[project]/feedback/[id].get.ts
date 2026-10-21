import type { FeedbackDetail } from '../../../../../shared/contracts'
import { getApp } from '../../../../core/apps'
import { getFeedback, issueLink, sameSenderCount } from '../../../../core/feedback'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { requestProject } from '#nexitas/server/utils/projects'

export default defineEventHandler((event): FeedbackDetail => {
  const db = nexitasDatabase()
  const item = getFeedback(db, requestProject(event).id, getRouterParam(event, 'id') ?? '')
  const app = item && getApp(db, item.appId)
  if (!item || !app) throw createError({ statusCode: 404, statusMessage: 'This feedback is gone.' })
  return { ...item, issueLink: issueLink(app, item), sameSender: sameSenderCount(db, item) }
})
