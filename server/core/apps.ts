// The apps feedback is collected for, one per project: what the form offers. Who may send it is
// the project's, in nexitas.
import type { DatabaseSync } from 'node:sqlite'
import type { AppConfig, AppSettings, AppSummary } from '../../shared/contracts'
import { isFull, STORED_BYTES } from './feedback'

interface AppRow {
  id: string
  project_id: string
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

// An app with what it takes from its project.
const APPS = `SELECT apps.*, projects.name, projects.origins
  FROM apps JOIN projects ON projects.id = apps.project_id`

function toConfig(row: AppRow): AppConfig {
  return {
    id: row.id,
    projectId: row.project_id,
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

/** The project's app with its counts, if it collects feedback. */
export function getProjectAppSummary(db: DatabaseSync, projectId: string): AppSummary | null {
  const row = db
    .prepare(
      `SELECT app.*,
        (SELECT count(*) FROM feedback WHERE app_id = app.id AND status = 'new') AS new_count,
        (SELECT count(*) FROM feedback WHERE app_id = app.id) AS total_count,
        (SELECT ${STORED_BYTES} FROM feedback WHERE app_id = app.id) AS stored_bytes
      FROM (${APPS} WHERE apps.project_id = ?) AS app`,
    )
    .get(projectId) as
    | (AppRow & { new_count: number; total_count: number; stored_bytes: number })
    | undefined
  if (!row) return null
  const app = toConfig(row)
  return {
    ...app,
    newCount: row.new_count,
    totalCount: row.total_count,
    full: isFull(app, { count: row.total_count, bytes: row.stored_bytes }),
  }
}

export function getApp(db: DatabaseSync, id: string): AppConfig | null {
  const row = db.prepare(`${APPS} WHERE apps.id = ?`).get(id) as AppRow | undefined
  return row ? toConfig(row) : null
}

/** The project's app, if it collects feedback. */
export function getProjectApp(db: DatabaseSync, projectId: string): AppConfig | null {
  const row = db.prepare(`${APPS} WHERE apps.project_id = ?`).get(projectId) as AppRow | undefined
  return row ? toConfig(row) : null
}

function values(app: AppSettings) {
  return [
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

/** False when the project has an app, or an app has this id, already. */
export function createApp(
  db: DatabaseSync,
  app: AppSettings & { id: string; projectId: string },
  now = Date.now(),
) {
  return (
    db
      .prepare(
        `INSERT OR IGNORE INTO apps
          (id, project_id, kinds, context, send_page, issue_repo, retention_days, max_message,
            max_feedback, max_storage_mb, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(app.id, app.projectId, ...values(app), now, now).changes === 1
  )
}

/** The id never changes: feedback and the embedded forms refer to it. */
export function updateApp(db: DatabaseSync, id: string, app: AppSettings, now = Date.now()) {
  return (
    db
      .prepare(
        `UPDATE apps SET kinds = ?, context = ?, send_page = ?,
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
