// The feedback limits per sender: kept in the database, so a restart does not hand a flood a
// fresh budget. A sender is stored only as a keyed hash of its network (see senderKey), and its
// row leaves once its window ends.
import type { DatabaseSync } from 'node:sqlite'
import { transaction } from '#nexitas/server/core/database'

/** Count an attempt against `key`; returns 0 when allowed, otherwise the seconds until it is. */
export function consumeAttempt(
  db: DatabaseSync,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  return transaction(db, () => {
    pruneAttempts(db, now)
    const current = db
      .prepare('SELECT attempts, resets_at FROM rate_limits WHERE key = ?')
      .get(key) as { attempts: number; resets_at: number } | undefined
    if (current && current.attempts >= limit) return Math.ceil((current.resets_at - now) / 1000)
    db.prepare(
      `INSERT INTO rate_limits (key, attempts, resets_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1`,
    ).run(key, now + windowMs)
    return 0
  })
}

/** Forgets windows that have run out, so no sender key outlives its limit. */
export function pruneAttempts(db: DatabaseSync, now = Date.now()) {
  db.prepare('DELETE FROM rate_limits WHERE resets_at <= ?').run(now)
}
