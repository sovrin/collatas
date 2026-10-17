import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const VERSION = 2

export function openDatabase(dataDir: string) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(resolve(dataDir, 'collatas.sqlite'))
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  transaction(db, () => {
    const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
      user_version: number
    }
    if (version > VERSION) throw new Error('This database requires a newer version of collatas.')
    if (version === 0)
      db.exec(`
      CREATE TABLE owner (id INTEGER PRIMARY KEY CHECK (id = 1), email TEXT NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE TABLE rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL);
      CREATE TABLE secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE apps (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, origins TEXT NOT NULL, kinds TEXT NOT NULL,
        context TEXT NOT NULL, send_page INTEGER NOT NULL DEFAULT 1, issue_repo TEXT NOT NULL DEFAULT '',
        retention_days INTEGER NOT NULL DEFAULT 180, enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE feedback (
        id TEXT PRIMARY KEY, app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, message TEXT NOT NULL, email TEXT, context TEXT NOT NULL, page TEXT,
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done', 'spam')),
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX feedback_inbox ON feedback(status, created_at);
      CREATE INDEX feedback_app ON feedback(app_id, created_at);
      PRAGMA user_version = 1;
    `)
    // Retention now covers every status and always ends; apps that kept feedback forever keep
    // it as long as allowed.
    if (version < 2)
      db.exec(
        'UPDATE apps SET retention_days = 3650 WHERE retention_days = 0; PRAGMA user_version = 2;',
      )
  })
  return db
}

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = run()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** A random key created on first use and kept in the database, e.g. for signing form tokens. */
export function secret(db: DatabaseSync, name: string) {
  db.prepare('INSERT OR IGNORE INTO secrets (name, value) VALUES (?, ?)').run(
    name,
    randomBytes(32).toString('hex'),
  )
  return (db.prepare('SELECT value FROM secrets WHERE name = ?').get(name) as { value: string })
    .value
}
