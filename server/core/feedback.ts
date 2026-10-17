import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type {
  AppConfig,
  FeedbackItem,
  FeedbackPage,
  InboxGroup,
  Kind,
  Status,
  Submission,
} from '../../shared/contracts'

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
  page: string | null
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
    page: row.page,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** What a submission keeps once its app has had its say. */
export interface Accepted {
  context: Record<string, string>
  page: string | null
}

/** Checks a submission against what its app allows. Returns the reason it is refused, or what to
 *  store. */
export function acceptSubmission(
  app: AppConfig,
  submission: Submission,
): { error: string } | Accepted {
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
  return { context, page: acceptPage(app, submission.page) }
}

/** The page the form was on, if the app sends pages and it lies on one of the app's sites. Any
 *  other address is dropped, so nothing can plant links to elsewhere in the admin. */
function acceptPage(app: AppConfig, page: string | undefined) {
  if (!app.sendPage || !page) return null
  try {
    const url = new URL(page)
    return app.origins.includes(url.origin) ? url.href : null
  } catch {
    return null
  }
}

export function addFeedback(
  db: DatabaseSync,
  appId: string,
  submission: Submission,
  { context, page }: Accepted,
  now = Date.now(),
) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO feedback (id, app_id, kind, message, email, context, page, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    appId,
    submission.kind,
    submission.message,
    submission.email || null,
    JSON.stringify(context),
    page,
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

/** The SQL condition for a filter, optionally for one app. */
function matching(filter: InboxFilter, app?: string) {
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
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

/** The overview across apps: per app with matching feedback, its counts and newest `perApp`
 *  entries. Apps with unread feedback come first, then the one heard from most recently. The
 *  database does the grouping, so the overview stays this size however much feedback there is. */
export function inboxOverview(db: DatabaseSync, filter: InboxFilter, perApp: number): InboxGroup[] {
  const { where, params } = matching(filter)
  const rows = db
    .prepare(
      `WITH matching AS (
        SELECT feedback.*, apps.name AS app_name FROM feedback JOIN apps ON apps.id = feedback.app_id
        ${where}
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY app_id ORDER BY created_at DESC, id) AS rank
        FROM matching
      ), stats AS (
        SELECT app_id, count(*) AS total, sum(status = 'new') AS new_count, max(created_at) AS newest
        FROM matching GROUP BY app_id
      )
      SELECT ranked.*, stats.total, stats.new_count FROM ranked JOIN stats USING (app_id)
      WHERE rank <= ?
      ORDER BY stats.new_count > 0 DESC, stats.newest DESC, ranked.app_id, ranked.rank`,
    )
    .all(...params, perApp) as unknown as (FeedbackRow & { total: number; new_count: number })[]
  const groups: InboxGroup[] = []
  for (const row of rows) {
    let group = groups.at(-1)
    if (group?.appId !== row.app_id) {
      group = {
        appId: row.app_id,
        appName: row.app_name,
        newCount: row.new_count,
        total: row.total,
        items: [],
      }
      groups.push(group)
    }
    group.items.push(toItem(row))
  }
  return groups
}

/** One page of matching feedback, newest first, with how many match in all. */
export function feedbackPage(
  db: DatabaseSync,
  {
    app,
    filter,
    page,
    pageSize,
  }: { app?: string; filter: InboxFilter; page: number; pageSize: number },
): FeedbackPage {
  const { where, params } = matching(filter, app)
  const { total, new_count } = db
    .prepare(
      `SELECT count(*) AS total, coalesce(sum(feedback.status = 'new'), 0) AS new_count
      FROM feedback ${where}`,
    )
    .get(...params) as { total: number; new_count: number }
  const rows = db
    .prepare(
      `SELECT feedback.*, apps.name AS app_name FROM feedback JOIN apps ON apps.id = feedback.app_id
      ${where} ORDER BY feedback.created_at DESC, feedback.id LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as FeedbackRow[]
  return { items: rows.map(toItem), total, newCount: new_count, page, pageSize }
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
