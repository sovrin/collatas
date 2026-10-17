import type { FeedbackDetail } from '#shared/contracts'
import { getApp } from '../../core/apps'
import { getFeedback, issueLink } from '../../core/feedback'
import { requireOwner } from '../../utils/auth'
import { collatasDatabase } from '../../utils/collatas'

export default defineEventHandler((event): FeedbackDetail => {
  requireOwner(event)
  const db = collatasDatabase()
  const item = getFeedback(db, getRouterParam(event, 'id') ?? '')
  const app = item && getApp(db, item.appId)
  if (!item || !app) throw createError({ statusCode: 404, statusMessage: 'This feedback is gone.' })
  return { ...item, issueLink: issueLink(app, item) }
})
