// collatas as a nexitas module: its schema, the public form routes a project's sites call, and its
// part of the status line and of each project. The owner's sign-in, the /api guard, the projects
// and the database itself are the core's.
import type { H3Event } from 'h3'
import type { NexitasModule } from '#nexitas/shared/modules'
import { announceChange } from '#nexitas/server/utils/changes'
import { nexitasDatabase } from '#nexitas/server/utils/nexitas'
import { projectCors } from '#nexitas/server/utils/cors'
import { deleteApp, getApp, getProjectApp } from './apps'
import { countNew, pruneFeedback, pruneSenderKeys } from './feedback'
import { pruneAttempts } from './limits'

export const collatas: NexitasModule = {
  id: 'collatas',
  migrations: [
    // Each project's feedback form (app), keyed by the project, and the feedback it took;
    // rate_limits holds the feedback limits per sender, secrets the keys collatas signs with.
    `CREATE TABLE rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL);
    CREATE TABLE secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE apps (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
      kinds TEXT NOT NULL, context TEXT NOT NULL, send_page INTEGER NOT NULL DEFAULT 1,
      issue_repo TEXT NOT NULL DEFAULT '', retention_days INTEGER NOT NULL DEFAULT 180,
      max_message INTEGER NOT NULL DEFAULT 1024, max_feedback INTEGER NOT NULL DEFAULT 1000,
      max_storage_mb INTEGER NOT NULL DEFAULT 512, enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE feedback (
      id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, message TEXT NOT NULL, email TEXT, context TEXT NOT NULL, page TEXT,
      sender TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done', 'spam')),
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE INDEX feedback_inbox ON feedback(status, created_at);
    CREATE INDEX feedback_app ON feedback(app_id, created_at);`,
  ],
  // The sites registered for an app may call its form routes from the browser. Feedback is a few
  // kB, within the core's default limit.
  publicRoutes: [{ path: /^\/v1\/apps\/([a-z0-9-]+)\/(form|feedback)$/, json: true, guard: cors }],
  // Everything collatas serves; switched off, all of it answers 404.
  paths: ['/feedback', '/api/feedback', '/v1/apps'],
  // Feedback leaves after its app's retention, rate limits once their window ends, and sender
  // keys after their day.
  hourly: (db) => {
    pruneAttempts(db)
    pruneSenderKeys(db)
    const removed = pruneFeedback(db)
    if (!removed) return
    console.info(`collatas: deleted ${removed} entries past retention`)
    announceChange()
  },
  projectStatus: (db, projectId) => {
    const app = getProjectApp(db, projectId)
    if (!app) return []
    const fresh = countNew(db, app.id)
    const to = `/p/${projectId}/feedback`
    return [
      fresh
        ? { text: `${fresh} new feedback`, to, tone: 'warning' }
        : { text: app.enabled ? 'no new feedback' : 'feedback paused', to },
    ]
  },
  // Its feedback goes with the app.
  deleteProject: (db, projectId) => {
    const app = getProjectApp(db, projectId)
    if (app) deleteApp(db, app.id)
  },
}

/** The app's project's sites may call its form routes; everyone else, and a paused or unknown
 *  app, is refused. */
function cors(event: H3Event, match: RegExpExecArray | null) {
  const app = getApp(nexitasDatabase(), match?.[1] ?? '')
  return projectCors(event, app?.enabled ? app.projectId : undefined, {
    methods: 'GET, POST',
    refusal: 'This site may not send feedback to this app.',
  })
}
