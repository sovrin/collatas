import { createHmac, randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type {
  AppConfig,
  FeedbackItem,
  FeedbackPage,
  Kind,
  Status,
  Submission,
} from '../../shared/contracts'
import { secret } from './secrets'

export const DAY = 24 * 60 * 60 * 1000
const MB = 1024 * 1024
const MAX_LINKS = 3

interface FeedbackRow {
  id: string
  app_id: string
  kind: Kind
  message: string
  email: string | null
  context: string
  page: string | null
  sender: string | null
  status: Status
  created_at: number
  updated_at: number
}

function toItem(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    appId: row.app_id,
    kind: row.kind,
    message: row.message,
    email: row.email,
    context: JSON.parse(row.context),
    page: row.page,
    sender: row.sender,
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
  if (submission.message.length > app.maxMessage)
    return { error: `Keep the message to ${app.maxMessage} characters.` }
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
    // The query and hash often hold tokens or emails: only the page's address is kept.
    return app.origins.includes(url.origin) ? url.origin + url.pathname : null
  } catch {
    return null
  }
}

export function addFeedback(
  db: DatabaseSync,
  appId: string,
  submission: Submission,
  { context, page, sender = null }: Accepted & { sender?: string | null },
  now = Date.now(),
) {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO feedback (id, app_id, kind, message, email, context, page, sender, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    appId,
    submission.kind,
    submission.message,
    submission.email || null,
    JSON.stringify(context),
    page,
    sender,
    now,
    now,
  )
  return id
}

const dayKey = (now: number) => `sender-day:${new Date(now).toISOString().slice(0, 10)}`

/** Tells one sender's feedback to an app apart from others' on the same UTC day, and no further:
 *  the key changes every day and the old one is deleted, after which a tag leads back to no one.
 *  `sender` is already a keyed hash; the address itself never gets here. */
export function senderTag(db: DatabaseSync, appId: string, sender: string, now = Date.now()) {
  return createHmac('sha256', secret(db, dayKey(now)))
    .update(`${appId}:${sender}`)
    .digest('hex')
    .slice(0, 8)
}

/** Deletes the keys of past days, so their tags can no longer be matched to a sender. */
export function pruneSenderKeys(db: DatabaseSync, now = Date.now()) {
  db.prepare("DELETE FROM secrets WHERE name LIKE 'sender-day:%' AND name <> ?").run(dayKey(now))
}

/** The bytes of what people sent, summed over the feedback rows of a query. */
export const STORED_BYTES = `coalesce(sum(length(CAST(feedback.message AS BLOB))
  + coalesce(length(CAST(feedback.email AS BLOB)), 0) + length(CAST(feedback.context AS BLOB))
  + coalesce(length(CAST(feedback.page AS BLOB)), 0)), 0)`

/** What an app's feedback holds: how many entries, and the bytes people sent. */
export function appUsage(db: DatabaseSync, appId: string) {
  return db
    .prepare(`SELECT count(*) AS count, ${STORED_BYTES} AS bytes FROM feedback WHERE app_id = ?`)
    .get(appId) as { count: number; bytes: number }
}

/** At either cap, an app takes no more feedback until some is deleted or expires. */
export function isFull(
  app: Pick<AppConfig, 'maxFeedback' | 'maxStorageMb'>,
  usage: { count: number; bytes: number },
) {
  return usage.count >= app.maxFeedback || usage.bytes >= app.maxStorageMb * MB
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

const SEARCHED = ['message', 'email', 'sender', 'context', 'page'].map(
  (column) => `feedback.${column} LIKE ? ESCAPE '\\'`,
)

/** The SQL condition for one app's feedback, a filter and a search: every word must appear in one
 *  of the searched columns, as part of a word too (a tag's start finds the tag). */
// shortcut: LIKE scans every row, fine while retention keeps the table small (milliseconds at the
// daily caps); move to an FTS5 index if searches ever get slow. Case folds for ASCII only.
function matching(filter: InboxFilter, app: string, search = '') {
  const where = ['feedback.app_id = ?']
  const params = [app]
  for (const word of search.split(/\s+/).filter(Boolean)) {
    where.push(`(${SEARCHED.join(' OR ')})`)
    params.push(...SEARCHED.map(() => `%${word.replace(/[\\%_]/g, '\\$&')}%`))
  }
  if (filter === 'open') where.push("feedback.status IN ('new', 'seen')")
  else if (filter !== 'all') {
    where.push('feedback.status = ?')
    params.push(filter)
  }
  return { where: `WHERE ${where.join(' AND ')}`, params }
}

/** One page of matching feedback, newest first, with how many match in all. */
export function feedbackPage(
  db: DatabaseSync,
  {
    app,
    filter,
    page,
    pageSize,
    search,
  }: { app: string; filter: InboxFilter; page: number; pageSize: number; search?: string },
): FeedbackPage {
  const { where, params } = matching(filter, app, search)
  const { total, new_count } = db
    .prepare(
      `SELECT count(*) AS total, coalesce(sum(feedback.status = 'new'), 0) AS new_count
      FROM feedback ${where}`,
    )
    .get(...params) as { total: number; new_count: number }
  const rows = db
    .prepare(
      `SELECT feedback.* FROM feedback ${where}
      ORDER BY feedback.created_at DESC, feedback.id LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as FeedbackRow[]
  return { items: rows.map(toItem), total, newCount: new_count, page, pageSize }
}

/** One of the project's feedback: another project's is not found. */
export function getFeedback(db: DatabaseSync, projectId: string, id: string): FeedbackItem | null {
  const row = db
    .prepare(
      `SELECT feedback.* FROM feedback JOIN apps ON apps.id = feedback.app_id
      WHERE feedback.id = ? AND apps.project_id = ?`,
    )
    .get(id, projectId) as FeedbackRow | undefined
  return row ? toItem(row) : null
}

/** How many other entries carry this one's sender tag: same app, same UTC day, any status. */
export function sameSenderCount(db: DatabaseSync, item: FeedbackItem) {
  if (!item.sender) return 0
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM feedback
      WHERE app_id = ? AND sender = ? AND id <> ? AND created_at / ${DAY} = ?`,
    )
    .get(item.appId, item.sender, item.id, Math.floor(item.createdAt / DAY)) as { count: number }
  return row.count
}

// The project's feedback only, as getFeedback.
const OF_PROJECT = 'id = ? AND app_id IN (SELECT id FROM apps WHERE project_id = ?)'

export function setStatus(
  db: DatabaseSync,
  projectId: string,
  id: string,
  status: Status,
  now = Date.now(),
) {
  return (
    db
      .prepare(`UPDATE feedback SET status = ?, updated_at = ? WHERE ${OF_PROJECT}`)
      .run(status, now, id, projectId).changes === 1
  )
}

export function deleteFeedback(db: DatabaseSync, projectId: string, id: string) {
  return db.prepare(`DELETE FROM feedback WHERE ${OF_PROJECT}`).run(id, projectId).changes === 1
}

/** An app's unread feedback. */
/** What still waits for the owner: new and seen, neither done nor spam. */
export function countOpen(db: DatabaseSync, appId: string) {
  return (
    db
      .prepare(
        "SELECT count(*) AS count FROM feedback WHERE status IN ('new', 'seen') AND app_id = ?",
      )
      .get(appId) as { count: number }
  ).count
}

/** Deletes feedback of any status once its app's retention has passed since its last change:
 *  what people send is personal data and is not kept without end. Returns how many. */
export function pruneFeedback(db: DatabaseSync, now = Date.now()) {
  return Number(
    db
      .prepare(
        `DELETE FROM feedback WHERE app_id IN (
          SELECT id FROM apps WHERE feedback.updated_at < ? - retention_days * ${DAY}
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

/** Feedback that arrived for the project since `since`, newest first, spam left out: the news on
 *  its overview. */
export function listArrivals(db: DatabaseSync, projectId: string, since: number) {
  return db
    .prepare(
      `SELECT f.id, f.kind, f.message, f.created_at AS at FROM feedback f
      JOIN apps a ON a.id = f.app_id
      WHERE a.project_id = ? AND f.created_at > ? AND f.status != 'spam'
      ORDER BY f.created_at DESC LIMIT 30`,
    )
    .all(projectId, since) as { id: string; kind: Kind; message: string; at: number }[]
}
