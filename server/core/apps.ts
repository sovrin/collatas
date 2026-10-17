// The registered apps: who may send feedback, and what the form offers them.
import type { DatabaseSync } from 'node:sqlite'
import type { AppConfig, AppSummary } from '../../shared/contracts'
import { isFull, STORED_BYTES } from './feedback'

interface AppRow {
  id: string
  name: string
  origins: string
  kinds: string
  context: string
  send_page: number
  issue_repo: string
  retention_days: number
  max_message: number
  max_feedback: number
  max_storage_mb: number
  enabled: number
}

function toConfig(row: AppRow): AppConfig {
  return {
    id: row.id,
    name: row.name,
    origins: JSON.parse(row.origins),
    kinds: JSON.parse(row.kinds),
    context: JSON.parse(row.context),
    sendPage: row.send_page === 1,
    issueRepo: row.issue_repo,
    retentionDays: row.retention_days,
    maxMessage: row.max_message,
    maxFeedback: row.max_feedback,
    maxStorageMb: row.max_storage_mb,
    enabled: row.enabled === 1,
  }
}

export function listApps(db: DatabaseSync): AppSummary[] {
  const rows = db
    .prepare(
      `SELECT apps.*,
        (SELECT count(*) FROM feedback WHERE app_id = apps.id AND status = 'new') AS new_count,
        (SELECT count(*) FROM feedback WHERE app_id = apps.id) AS total_count,
        (SELECT ${STORED_BYTES} FROM feedback WHERE app_id = apps.id) AS stored_bytes
      FROM apps ORDER BY name COLLATE NOCASE`,
    )
    .all() as unknown as (AppRow & {
    new_count: number
    total_count: number
    stored_bytes: number
  })[]
  return rows.map((row) => {
    const app = toConfig(row)
    return {
      ...app,
      newCount: row.new_count,
      totalCount: row.total_count,
      full: isFull(app, { count: row.total_count, bytes: row.stored_bytes }),
    }
  })
}

export function getApp(db: DatabaseSync, id: string): AppConfig | null {
  const row = db.prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined
  return row ? toConfig(row) : null
}

function values(app: AppConfig) {
  return [
    app.name,
    JSON.stringify(app.origins),
    JSON.stringify(app.kinds),
    JSON.stringify(app.context),
    app.sendPage ? 1 : 0,
    app.issueRepo,
    app.retentionDays,
    app.maxMessage,
    app.maxFeedback,
    app.maxStorageMb,
    app.enabled ? 1 : 0,
  ] as const
}

/** False when an app with this id exists already. */
export function createApp(db: DatabaseSync, app: AppConfig, now = Date.now()) {
  return (
    db
      .prepare(
        `INSERT OR IGNORE INTO apps
          (id, name, origins, kinds, context, send_page, issue_repo, retention_days, max_message,
            max_feedback, max_storage_mb, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(app.id, ...values(app), now, now).changes === 1
  )
}

/** The id never changes: feedback and the embedded forms refer to it. */
export function updateApp(db: DatabaseSync, id: string, app: AppConfig, now = Date.now()) {
  return (
    db
      .prepare(
        `UPDATE apps SET name = ?, origins = ?, kinds = ?, context = ?, send_page = ?,
          issue_repo = ?, retention_days = ?, max_message = ?, max_feedback = ?,
          max_storage_mb = ?, enabled = ?, updated_at = ?
        WHERE id = ?`,
      )
      .run(...values(app), now, id).changes === 1
  )
}

/** Deletes the app and all its feedback. */
export function deleteApp(db: DatabaseSync, id: string) {
  return db.prepare('DELETE FROM apps WHERE id = ?').run(id).changes === 1
}
