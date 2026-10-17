// The owner account and its sessions: scrypt passwords, sessions stored only as
// hashes, and a persisted attempt budget so a restart does not reset brute-force protection.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { transaction } from './database'

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, result) => (error ? reject(error) : resolve(result)),
    )
  })
}

export function tokensMatch(supplied: string, expected: string) {
  return timingSafeEqual(
    Buffer.from(hashToken(supplied), 'hex'),
    Buffer.from(hashToken(expected), 'hex'),
  )
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt:${salt}:${(await derivePassword(password, salt)).toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, encoded] = stored.split(':')
  if (algorithm !== 'scrypt' || !salt || !encoded) return false
  const actual = await derivePassword(password, salt)
  const expected = Buffer.from(encoded, 'hex')
  return expected.length === actual.length && timingSafeEqual(actual, expected)
}

export function getOwner(db: DatabaseSync): { email: string } | null {
  return (
    (db.prepare('SELECT email FROM owner WHERE id = 1').get() as { email: string } | undefined) ??
    null
  )
}

export function createOwner(db: DatabaseSync, email: string, passwordHash: string): boolean {
  return (
    db
      .prepare('INSERT OR IGNORE INTO owner (id, email, password_hash) VALUES (1, ?, ?)')
      .run(email, passwordHash).changes === 1
  )
}

export async function authenticate(db: DatabaseSync, email: string, password: string) {
  const owner = db.prepare('SELECT email, password_hash FROM owner WHERE id = 1').get() as
    | { email: string; password_hash: string }
    | undefined
  if (!owner) return false
  const validPassword = await verifyPassword(password, owner.password_hash)
  return owner.email === email && validPassword
}

export function createSession(db: DatabaseSync, now = Date.now()) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = now + SESSION_DURATION
  transaction(db, () => {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
    db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').run(
      hashToken(token),
      expiresAt,
    )
  })
  return { token, expiresAt }
}

export function sessionOwner(db: DatabaseSync, token: string | undefined, now = Date.now()) {
  if (!token || token.length > 128) return null
  const session = db
    .prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .get(hashToken(token), now)
  return session ? getOwner(db) : null
}

export function revokeSession(db: DatabaseSync, token: string | undefined) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

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

/** The network a sender is counted by: an IPv6 address cut to its /64, which one connection
 *  usually holds whole (otherwise every request could come from a new address); an IPv4
 *  address, also one mapped into IPv6, as it is. */
export function senderNetwork(address: string) {
  const plain = address.replace(/%.*$/, '').toLowerCase()
  if (!plain.includes(':')) return plain
  if (plain.includes('.')) return plain.slice(plain.lastIndexOf(':') + 1)
  const [head = '', tail] = plain.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return `${groups
    .slice(0, 4)
    .map((group) => Number.parseInt(group || '0', 16).toString(16))
    .join(':')}::/64`
}

/** Forgets windows that have run out, so no sender key outlives its limit. */
export function pruneAttempts(db: DatabaseSync, now = Date.now()) {
  db.prepare('DELETE FROM rate_limits WHERE resets_at <= ?').run(now)
}

const AUTH_WINDOW = 15 * 60 * 1000

export function consumeAuthAttempt(
  db: DatabaseSync,
  key: string,
  sender: string,
  now = Date.now(),
) {
  // Per sender, so one caller cannot lock the owner out; the shared ceiling still stops a botnet.
  return (
    consumeAttempt(db, `auth:${key}:${sender}`, 10, AUTH_WINDOW, now) ||
    consumeAttempt(db, `auth:${key}`, 100, AUTH_WINDOW, now)
  )
}

export function resetOwner(db: DatabaseSync) {
  transaction(db, () =>
    db.exec(
      "DELETE FROM sessions; DELETE FROM owner; DELETE FROM rate_limits WHERE key LIKE 'auth:%';",
    ),
  )
}
