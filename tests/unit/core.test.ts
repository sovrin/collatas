import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { appConfigSchema, type AppConfig, type Submission } from '../../shared/contracts'
import { createApp, deleteApp, getApp, listApps, updateApp } from '../../server/core/apps'
import { consumeAttempt } from '../../server/core/auth'
import { openDatabase, secret } from '../../server/core/database'
import {
  acceptSubmission,
  addFeedback,
  countLastDay,
  getFeedback,
  issueLink,
  feedbackPage,
  inboxOverview,
  type InboxFilter,
  pruneFeedback,
  setStatus,
} from '../../server/core/feedback'
import { checkToken, issueToken } from '../../server/core/token'

const DAY = 24 * 60 * 60 * 1000
const NOTHING = { context: {}, page: null }
const list = (db: DatabaseSync, filter: InboxFilter, app?: string) =>
  feedbackPage(db, { app, filter, page: 1, pageSize: 100 }).items
const dirs: string[] = []
const dbs: DatabaseSync[] = []

function database() {
  const dir = mkdtempSync(join(tmpdir(), 'collatas-test-'))
  dirs.push(dir)
  const db = openDatabase(dir)
  dbs.push(db)
  return db
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const sonotas: AppConfig = {
  id: 'sonotas',
  name: 'sonotas',
  origins: ['https://sonotas.sovrin.de'],
  kinds: ['problem', 'idea'],
  context: [
    { key: 'version', max: 20 },
    { key: 'settings', max: 200 },
  ],
  sendPage: true,
  issueRepo: 'sovrin/sonotas',
  retentionDays: 30,
  enabled: true,
}

const submission = (overrides: Partial<Submission> = {}): Submission => ({
  token: '',
  kind: 'problem',
  message: 'Export stalls at 80%',
  ...overrides,
})

describe('form tokens', () => {
  const key = 'k'.repeat(64)
  it('holds between three seconds and two hours, for its app only', () => {
    const token = issueToken(key, 'sonotas', 1_000_000)
    expect(checkToken(key, 'sonotas', token, 1_001_000)).toBe('early')
    expect(checkToken(key, 'sonotas', token, 1_010_000)).toBe('ok')
    expect(checkToken(key, 'sonotas', token, 1_000_000 + 3 * 60 * 60 * 1000)).toBe('invalid')
    expect(checkToken(key, 'other', token, 1_010_000)).toBe('invalid')
    expect(checkToken('x'.repeat(64), 'sonotas', token, 1_010_000)).toBe('invalid')
    expect(checkToken(key, 'sonotas', 'nonsense', 1_010_000)).toBe('invalid')
  })
})

describe('app settings', () => {
  it('accept origins without a trailing slash and refuse paths', () => {
    const parsed = appConfigSchema.parse({ ...sonotas, origins: ['https://sonotas.sovrin.de/'] })
    expect(parsed.origins).toEqual(['https://sonotas.sovrin.de'])
    expect(
      appConfigSchema.safeParse({ ...sonotas, origins: ['https://sonotas.sovrin.de/app'] }).success,
    ).toBe(false)
    expect(appConfigSchema.safeParse({ ...sonotas, id: 'Sonotas' }).success).toBe(false)
    expect(appConfigSchema.safeParse({ ...sonotas, kinds: [] }).success).toBe(false)
    expect(
      appConfigSchema.safeParse({
        ...sonotas,
        context: [
          { key: 'a', max: 1 },
          { key: 'a', max: 2 },
        ],
      }).success,
    ).toBe(false)
  })

  it('are stored, listed with counts, changed and deleted with their feedback', () => {
    const db = database()
    expect(createApp(db, sonotas)).toBe(true)
    expect(createApp(db, sonotas)).toBe(false)
    expect(getApp(db, 'sonotas')).toEqual(sonotas)
    addFeedback(db, 'sonotas', submission(), NOTHING)
    expect(listApps(db)[0]).toMatchObject({ id: 'sonotas', newCount: 1, totalCount: 1 })
    updateApp(db, 'sonotas', { ...sonotas, enabled: false })
    expect(getApp(db, 'sonotas')?.enabled).toBe(false)
    expect(deleteApp(db, 'sonotas')).toBe(true)
    expect(list(db, 'all')).toEqual([])
  })
})

describe('submissions', () => {
  it('keep only what the app allows', () => {
    expect(acceptSubmission(sonotas, submission({ context: { version: '0.2.0' } }))).toEqual({
      context: { version: '0.2.0' },
      page: null,
    })
    expect(acceptSubmission(sonotas, submission({ kind: 'other' }))).toHaveProperty('error')
    expect(acceptSubmission(sonotas, submission({ context: { secret: 'x' } }))).toHaveProperty(
      'error',
    )
    expect(
      acceptSubmission(sonotas, submission({ context: { version: 'x'.repeat(21) } })),
    ).toHaveProperty('error')
    expect(
      acceptSubmission(sonotas, submission({ message: 'https://a https://b https://c https://d' })),
    ).toHaveProperty('error')
  })

  it('are counted per day, filtered in the inbox and change status', () => {
    const db = database()
    createApp(db, sonotas)
    const now = 10 * DAY
    const id = addFeedback(db, 'sonotas', submission(), NOTHING, now)
    addFeedback(db, 'sonotas', submission(), NOTHING, now - 2 * DAY)
    expect(countLastDay(db, 'sonotas', now)).toBe(1)
    expect(list(db, 'open')).toHaveLength(2)
    setStatus(db, id, 'done')
    expect(list(db, 'open')).toHaveLength(1)
    expect(list(db, 'done', 'sonotas')[0]?.id).toBe(id)
    expect(getFeedback(db, id)?.appName).toBe('sonotas')
  })
})

describe('inbox', () => {
  it('groups by app, unread first, newest few each, with counts', () => {
    const db = database()
    createApp(db, sonotas)
    createApp(db, { ...sonotas, id: 'quiet' })
    createApp(db, { ...sonotas, id: 'empty' })
    const now = 10 * DAY
    for (let i = 0; i < 7; i++) {
      const id = addFeedback(
        db,
        'sonotas',
        submission({ message: `s${i}` }),
        NOTHING,
        now - i * 1000,
      )
      if (i > 0) setStatus(db, id, 'seen')
    }
    // quiet was heard from last, but has nothing unread
    const latest = addFeedback(db, 'quiet', submission({ message: 'q' }), NOTHING, now + 1000)
    setStatus(db, latest, 'seen')
    const groups = inboxOverview(db, 'open', 5)
    expect(groups.map((group) => group.appId)).toEqual(['sonotas', 'quiet'])
    expect(groups[0]).toMatchObject({ newCount: 1, total: 7 })
    expect(groups[0]!.items.map((item) => item.message)).toEqual(['s0', 's1', 's2', 's3', 's4'])
    expect(inboxOverview(db, 'done', 5)).toEqual([])
  })

  it('pages one app, newest first, with the total', () => {
    const db = database()
    createApp(db, sonotas)
    for (let i = 0; i < 7; i++)
      addFeedback(db, 'sonotas', submission({ message: `m${i}` }), NOTHING, i)
    const second = feedbackPage(db, { app: 'sonotas', filter: 'all', page: 2, pageSize: 3 })
    expect(second.items.map((item) => item.message)).toEqual(['m3', 'm2', 'm1'])
    expect(second).toMatchObject({ total: 7, newCount: 7, page: 2 })
    expect(feedbackPage(db, { filter: 'all', page: 4, pageSize: 3 }).items).toEqual([])
  })
})

describe('retention', () => {
  it('deletes done and spam past the app retention, never open feedback', () => {
    const db = database()
    createApp(db, sonotas)
    createApp(db, { ...sonotas, id: 'kept', retentionDays: 0 })
    const old = 100 * DAY
    const done = addFeedback(db, 'sonotas', submission(), NOTHING, old)
    setStatus(db, done, 'done', old)
    addFeedback(db, 'sonotas', submission(), NOTHING, old)
    const forever = addFeedback(db, 'kept', submission(), NOTHING, old)
    setStatus(db, forever, 'spam', old)
    expect(pruneFeedback(db, old + 31 * DAY)).toBe(1)
    expect(getFeedback(db, done)).toBeNull()
    expect(list(db, 'all')).toHaveLength(2)
  })
})

describe('links', () => {
  it("keep the page only from the app's own sites, and only when it sends pages", () => {
    const page = 'https://sonotas.sovrin.de/?s=abc#bar-4'
    const accepted = (overrides: Partial<Submission>, app = sonotas) =>
      'error' in acceptSubmission(app, submission(overrides))
        ? null
        : (acceptSubmission(app, submission(overrides)) as { page: string | null }).page
    expect(accepted({ page })).toBe(page)
    expect(accepted({ page: 'https://evil.example/?s=abc' })).toBeNull()
    expect(accepted({ page: 'not a url' })).toBeNull()
    expect(accepted({ page }, { ...sonotas, sendPage: false })).toBeNull()
  })

  it('are stored with their page', () => {
    const db = database()
    createApp(db, sonotas)
    const id = addFeedback(db, 'sonotas', submission(), {
      context: {},
      page: 'https://sonotas.sovrin.de/',
    })
    expect(getFeedback(db, id)?.page).toBe('https://sonotas.sovrin.de/')
  })

  it('prefill a GitHub issue without the sender email', () => {
    const link = issueLink(sonotas, {
      id: '1',
      appId: 'sonotas',
      appName: 'sonotas',
      kind: 'problem',
      message: 'Export stalls\nat 80%',
      email: 'someone@example.com',
      context: { version: '0.2.0' },
      page: null,
      status: 'new',
      createdAt: 0,
      updatedAt: 0,
    })!
    const url = new URL(link)
    expect(url.pathname).toBe('/sovrin/sonotas/issues/new')
    expect(url.searchParams.get('title')).toBe('Export stalls')
    expect(url.searchParams.get('body')).toContain('version: `0.2.0`')
    expect(link).not.toContain('someone')
  })
})

describe('rate limits and secrets', () => {
  it('allow a set number of attempts per window', () => {
    const db = database()
    for (let i = 0; i < 5; i++) expect(consumeAttempt(db, 'send:a:1', 5, 60_000, 0)).toBe(0)
    expect(consumeAttempt(db, 'send:a:1', 5, 60_000, 1000)).toBe(59)
    expect(consumeAttempt(db, 'send:a:1', 5, 60_000, 60_001)).toBe(0)
  })

  it('keep a secret once created', () => {
    const db = database()
    expect(secret(db, 'form-key')).toBe(secret(db, 'form-key'))
    expect(secret(db, 'form-key')).toHaveLength(64)
  })
})
