import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

/** A random key created on first use and kept in the database, e.g. for signing form tokens. */
export function secret(db: DatabaseSync, name: string) {
  db.prepare('INSERT OR IGNORE INTO secrets (name, value) VALUES (?, ?)').run(
    name,
    randomBytes(32).toString('hex'),
  )
  return (db.prepare('SELECT value FROM secrets WHERE name = ?').get(name) as { value: string })
    .value
}
