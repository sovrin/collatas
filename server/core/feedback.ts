import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { AppConfig, FeedbackItem, Kind, Status, Submission } from '../../shared/contracts'

const DAY = 24 * 60 * 60 * 1000
const MAX_LINKS = 3

interface FeedbackRow {
  id: string
  app_id: string
  app_name: string
  kind: Kind
  message: string
  email: string | null
  context: string
  status: Status
  created_at: number
  updated_at: number
}

function toItem(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    appId: row.app_id,
    appName: row.app_name,
    kind: row.kind,
    message: row.message,
    email: row.email,
    context: JSON.parse(row.context),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Checks a submission against what its app allows. Returns the reason it is refused, or the
 *  context to store. */
export function acceptSubmission(
  app: AppConfig,
  submission: Submission,
): { error: string } | { context: Record<string, string> } {
  if (!app.kinds.includes(submission.kind)) return { error: 'This kind is not offered.' }
  if ((submission.message.match(/https?:\/\//g) ?? []).length > MAX_LINKS)
    return { error: `Use at most ${MAX_LINKS} links.` }
  const context: Record<string, string> = {}
  for (const [key, value] of Object.entries(submission.context ?? {})) {
    const field = app.context.find((candidate) => candidate.key === key)
    if (!field) return { error: `The context field ${key} is not configured.` }
    if (value.length > field.max) return { error: `The context field ${key} is too long.` }
    context[key] = value
  }
  return { context }
}

export function addFeedback(
  db: DatabaseSync,
  appId: string,
  submission: Submission,
  context: Record<string, string>,
  now = Date.now(),
) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO feedback (id, app_id, kind, message, email, context, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    appId,
    submission.kind,
    submission.message,
    submission.email || null,
    JSON.stringify(context),
    now,
    now,
  )
  return id
}

/** How many entries an app received in the last day: the cap against a flood. */
export function countLastDay(db: DatabaseSync, appId: string, now = Date.now()) {
  return (
    db
      .prepare('SELECT count(*) AS count FROM feedback WHERE app_id = ? AND created_at > ?')
      .get(appId, now - DAY) as { count: number }
  ).count
}

/** `open` is everything not yet dealt with: new and seen. */
export type InboxFilter = 'open' | Status | 'all'

export function listFeedback(
  db: DatabaseSync,
  { app, filter }: { app?: string; filter: InboxFilter },
): FeedbackItem[] {
  const where: string[] = []
  const params: string[] = []
  if (app) {
    where.push('feedback.app_id = ?')
    params.push(app)
  }
  if (filter === 'open') where.push("feedback.status IN ('new', 'seen')")
  else if (filter !== 'all') {
    where.push('feedback.status = ?')
    params.push(filter)
  }
  const rows = db
    .prepare(
      `SELECT feedback.*, apps.name AS app_name FROM feedback JOIN apps ON apps.id = feedback.app_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY feedback.created_at DESC LIMIT 500`,
    )
    .all(...params) as unknown as FeedbackRow[]
  return rows.map(toItem)
}

export function getFeedback(db: DatabaseSync, id: string): FeedbackItem | null {
  const row = db
    .prepare(
      `SELECT feedback.*, apps.name AS app_name FROM feedback JOIN apps ON apps.id = feedback.app_id
      WHERE feedback.id = ?`,
    )
    .get(id) as FeedbackRow | undefined
  return row ? toItem(row) : null
}

export function setStatus(db: DatabaseSync, id: string, status: Status, now = Date.now()) {
  return (
    db.prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
      .changes === 1
  )
}

export function deleteFeedback(db: DatabaseSync, id: string) {
  return db.prepare('DELETE FROM feedback WHERE id = ?').run(id).changes === 1
}

export function countNew(db: DatabaseSync) {
  return (
    db.prepare("SELECT count(*) AS count FROM feedback WHERE status = 'new'").get() as {
      count: number
    }
  ).count
}

/** Deletes done and spam feedback older than its app's retention. Returns how many. */
export function pruneFeedback(db: DatabaseSync, now = Date.now()) {
  return Number(
    db
      .prepare(
        `DELETE FROM feedback WHERE status IN ('done', 'spam') AND app_id IN (
          SELECT id FROM apps WHERE retention_days > 0
            AND feedback.updated_at < ? - retention_days * ${DAY}
        )`,
      )
      .run(now).changes,
  )
}

/** The app's setup address with {key} placeholders filled from the feedback's context, or null
 *  when the app has none or a placeholder has no value. */
export function setupLink(app: AppConfig, context: Record<string, string>) {
  if (!app.setupUrl) return null
  let missing = false
  const link = app.setupUrl.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!context[key]) missing = true
    return encodeURIComponent(context[key] ?? '')
  })
  return missing ? null : link
}

/** A prefilled "new issue" on GitHub for the owner to review and submit. The sender's email
 *  stays out: an issue is public. */
export function issueLink(app: AppConfig, item: FeedbackItem) {
  if (!app.issueRepo) return null
  const firstLine = item.message.split('\n')[0]!.trim()
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine
  const details = Object.entries(item.context).map(([key, value]) => `- ${key}: \`${value}\``)
  const body = [item.message, ...(details.length ? ['', '---', ...details] : [])].join('\n')
  const url = new URL(`https://github.com/${app.issueRepo}/issues/new`)
  url.searchParams.set('title', title)
  // GitHub refuses very long URLs; the message is the part that can be trimmed.
  url.searchParams.set('body', body.length > 6000 ? `${body.slice(0, 6000)}…` : body)
  return url.toString()
}
