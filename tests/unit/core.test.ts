import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { appSettingsSchema, type AppConfig, type Submission } from '../../shared/contracts'
import {
  createApp as addApp,
  deleteApp,
  getApp,
  getProjectAppSummary,
  updateApp,
} from '../../server/core/apps'
import { openDatabase } from '#nexitas/server/core/database'
import { createProject } from '#nexitas/server/core/projects'
import {
  acceptSubmission,
  addFeedback,
  appUsage,
  countLastDay,
  deleteFeedback,
  getFeedback,
  issueLink,
  feedbackPage,
  isFull,
  type InboxFilter,
  pruneFeedback,
  pruneSenderKeys,
  sameSenderCount,
  senderTag,
  setStatus,
} from '../../server/core/feedback'
import { consumeAttempt } from '../../server/core/limits'
import { collatas } from '../../server/core/module'
import { secret } from '../../server/core/secrets'
import { checkToken, issueToken } from '../../server/core/token'

const DAY = 24 * 60 * 60 * 1000
const NOTHING = { context: {}, page: null }
const list = (db: DatabaseSync, filter: InboxFilter, app = 'sonotas') =>
  feedbackPage(db, { app, filter, page: 1, pageSize: 100 }).items
const dirs: string[] = []
const dbs: DatabaseSync[] = []

function database() {
  const dir = mkdtempSync(join(tmpdir(), 'collatas-test-'))
  dirs.push(dir)
  const db = openDatabase(join(dir, 'collatas.sqlite'), [collatas])
  dbs.push(db)
  return db
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const sonotas: AppConfig = {
  id: 'sonotas',
  projectId: 'sonotas',
  name: 'sonotas',
  origins: ['https://sonotas.example.com'],
  kinds: ['problem', 'idea'],
  context: [
    { key: 'version', max: 20 },
    { key: 'settings', max: 200 },
  ],
  sendPage: true,
  issueRepo: 'sovrin/sonotas',
  retentionDays: 30,
  maxMessage: 1024,
  maxFeedback: 1000,
  maxStorageMb: 512,
  enabled: true,
}

/** Registers the app on a project of its own id, as the project's page does. */
function createApp(db: DatabaseSync, app: AppConfig) {
  createProject(db, { id: app.id, name: app.name, origins: app.origins })
  return addApp(db, { ...app, projectId: app.id })
}

/** An app's own settings, without what its project holds. */
const settings = ({
  id: _id,
  projectId: _project,
  name: _name,
  origins: _origins,
  ...rest
}: AppConfig) => rest

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
  it('refuse no kinds and a context field twice', () => {
    expect(appSettingsSchema.safeParse(settings(sonotas)).success).toBe(true)
    expect(appSettingsSchema.safeParse({ ...settings(sonotas), kinds: [] }).success).toBe(false)
    expect(
      appSettingsSchema.safeParse({
        ...settings(sonotas),
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
    expect(getProjectAppSummary(db, 'sonotas')).toMatchObject({
      id: 'sonotas',
      newCount: 1,
      totalCount: 1,
    })
    updateApp(db, 'sonotas', { ...settings(sonotas), enabled: false })
    expect(getApp(db, 'sonotas')?.enabled).toBe(false)
    expect(deleteApp(db, 'sonotas')).toBe(true)
    expect(list(db, 'all')).toEqual([])
  })
})

describe('projects', () => {
  it('show their new feedback, and take their app and its feedback when they go', () => {
    const db = database()
    createProject(db, { id: 'bare', name: 'bare', origins: ['https://bare.example.com'] })
    expect(collatas.projectStatus!(db, 'bare')).toEqual([
      { text: 'Not set up', to: '/p/bare/feedback' },
    ])
    createApp(db, sonotas)
    expect(collatas.projectStatus!(db, 'sonotas')).toEqual([
      { text: 'no new feedback', to: '/p/sonotas/feedback', figure: '0' },
    ])
    addFeedback(db, 'sonotas', submission(), NOTHING)
    expect(collatas.projectStatus!(db, 'sonotas')).toEqual([
      { text: '1 new feedback', to: '/p/sonotas/feedback', tone: 'warning', figure: '1' },
    ])
    expect(addApp(db, { ...sonotas, id: 'second' })).toBe(false)
    collatas.deleteProject!(db, 'sonotas')
    expect(getApp(db, 'sonotas')).toBeNull()
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
    expect(acceptSubmission(sonotas, submission({ message: 'x'.repeat(1024) }))).not.toHaveProperty(
      'error',
    )
    expect(
      acceptSubmission({ ...sonotas, maxMessage: 10 }, submission({ message: 'x'.repeat(11) })),
    ).toHaveProperty('error')
  })

  it("stop at an app's cap on entries or on what they hold, and show it as full", () => {
    const db = database()
    createApp(db, { ...sonotas, maxFeedback: 2 })
    expect(appUsage(db, 'sonotas')).toEqual({ count: 0, bytes: 0 })
    addFeedback(db, 'sonotas', submission({ message: 'äb' }), {
      context: { version: '1' },
      page: 'https://sonotas.example.com/',
    })
    // 3 bytes of message, 15 of context JSON, 28 of page
    expect(appUsage(db, 'sonotas')).toEqual({ count: 1, bytes: 46 })
    expect(getProjectAppSummary(db, 'sonotas')?.full).toBe(false)
    addFeedback(db, 'sonotas', submission(), NOTHING)
    expect(getProjectAppSummary(db, 'sonotas')?.full).toBe(true)
    expect(collatas.projectStatus!(db, 'sonotas')).toContainEqual({
      text: 'feedback form full',
      to: '/p/sonotas/feedback?setup',
      tone: 'warning',
    })
    expect(isFull({ maxFeedback: 10, maxStorageMb: 1 }, { count: 1, bytes: 1024 * 1024 })).toBe(
      true,
    )
    expect(isFull({ maxFeedback: 10, maxStorageMb: 1 }, { count: 9, bytes: 1024 * 1024 - 1 })).toBe(
      false,
    )
  })

  it('are counted per day, filtered in the inbox and change status', () => {
    const db = database()
    createApp(db, sonotas)
    const now = 10 * DAY
    const id = addFeedback(db, 'sonotas', submission(), NOTHING, now)
    addFeedback(db, 'sonotas', submission(), NOTHING, now - 2 * DAY)
    expect(countLastDay(db, 'sonotas', now)).toBe(1)
    expect(list(db, 'open')).toHaveLength(2)
    setStatus(db, 'sonotas', id, 'done')
    expect(list(db, 'open')).toHaveLength(1)
    expect(list(db, 'done', 'sonotas')[0]?.id).toBe(id)
  })

  it('are found, changed and deleted by their own project only', () => {
    const db = database()
    createApp(db, sonotas)
    createApp(db, { ...sonotas, id: 'other' })
    const id = addFeedback(db, 'sonotas', submission(), NOTHING)
    expect(getFeedback(db, 'other', id)).toBeNull()
    expect(setStatus(db, 'other', id, 'done')).toBe(false)
    expect(deleteFeedback(db, 'other', id)).toBe(false)
    expect(getFeedback(db, 'sonotas', id)?.status).toBe('new')
    expect(deleteFeedback(db, 'sonotas', id)).toBe(true)
  })
})

describe('inbox', () => {
  it('pages one app, newest first, with the total', () => {
    const db = database()
    createApp(db, sonotas)
    for (let i = 0; i < 7; i++)
      addFeedback(db, 'sonotas', submission({ message: `m${i}` }), NOTHING, i)
    const second = feedbackPage(db, { app: 'sonotas', filter: 'all', page: 2, pageSize: 3 })
    expect(second.items.map((item) => item.message)).toEqual(['m3', 'm2', 'm1'])
    expect(second).toMatchObject({ total: 7, newCount: 7, page: 2 })
    expect(feedbackPage(db, { app: 'sonotas', filter: 'all', page: 4, pageSize: 3 }).items).toEqual(
      [],
    )
  })
})

describe('search', () => {
  it('finds every word anywhere searched, a tag by its start, and takes % and _ literally', () => {
    const db = database()
    createApp(db, sonotas)
    createApp(db, { ...sonotas, id: 'other' })
    const add = (app: string, overrides: Partial<Submission>, sender: string | null = null) =>
      addFeedback(db, app, submission(overrides), {
        context: { version: '0.2.0' },
        page: null,
        sender,
      })
    const stall = add('sonotas', { message: 'Export stalls at 80%' }, '6a57ef8e')
    const dialog = add('sonotas', { message: 'Dialog hides the panel', email: 'pat@example.com' })
    add('other', { message: 'Export works fine' })
    const find = (search: string, app = 'sonotas') =>
      feedbackPage(db, { app, filter: 'all', page: 1, pageSize: 100, search }).items.map(
        (item) => item.id,
      )
    expect(find('export STALL')).toEqual([stall])
    expect(find('6a57')).toEqual([stall])
    expect(find('pat@example')).toEqual([dialog])
    expect(find('0.2.0', 'sonotas')).toHaveLength(2)
    expect(find('80%')).toEqual([stall])
    expect(find('8_%')).toEqual([])
    expect(find('export', 'other')).toHaveLength(1)
  })
})

describe('retention', () => {
  it('deletes feedback of every status past the app retention since its last change', () => {
    const db = database()
    createApp(db, sonotas)
    createApp(db, { ...sonotas, id: 'longer', retentionDays: 60 })
    const old = 100 * DAY
    const done = addFeedback(db, 'sonotas', submission(), NOTHING, old)
    setStatus(db, 'sonotas', done, 'done', old)
    const unread = addFeedback(db, 'sonotas', submission(), NOTHING, old)
    const touched = addFeedback(db, 'sonotas', submission(), NOTHING, old)
    setStatus(db, 'sonotas', touched, 'seen', old + 10 * DAY)
    addFeedback(db, 'longer', submission(), NOTHING, old)
    expect(pruneFeedback(db, old + 31 * DAY)).toBe(2)
    expect(getFeedback(db, 'sonotas', done)).toBeNull()
    expect(getFeedback(db, 'sonotas', unread)).toBeNull()
    expect(list(db, 'all')).toHaveLength(1)
    expect(list(db, 'all', 'longer')).toHaveLength(1)
  })

  it('refuses keeping forever', () => {
    expect(appSettingsSchema.safeParse({ ...settings(sonotas), retentionDays: 0 }).success).toBe(
      false,
    )
  })
})

describe('links', () => {
  it("keep the page only from the app's own sites, and only when it sends pages", () => {
    const page = 'https://sonotas.example.com/?reset=abc&email=a@b.c#access_token=secret'
    const accepted = (overrides: Partial<Submission>, app = sonotas) =>
      'error' in acceptSubmission(app, submission(overrides))
        ? null
        : (acceptSubmission(app, submission(overrides)) as { page: string | null }).page
    expect(accepted({ page })).toBe('https://sonotas.example.com/')
    expect(accepted({ page: 'https://evil.example/?s=abc' })).toBeNull()
    expect(accepted({ page: 'not a url' })).toBeNull()
    expect(accepted({ page }, { ...sonotas, sendPage: false })).toBeNull()
  })

  it('are stored with their page', () => {
    const db = database()
    createApp(db, sonotas)
    const id = addFeedback(db, 'sonotas', submission(), {
      context: {},
      page: 'https://sonotas.example.com/',
    })
    expect(getFeedback(db, 'sonotas', id)?.page).toBe('https://sonotas.example.com/')
  })

  it('prefill a GitHub issue without the sender email', () => {
    const link = issueLink(sonotas, {
      id: '1',
      appId: 'sonotas',
      projectId: 'sonotas',
      kind: 'problem',
      message: 'Export stalls\nat 80%',
      email: 'someone@example.com',
      context: { version: '0.2.0' },
      page: null,
      sender: null,
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

describe('sender tags', () => {
  it('match within an app and a day only, and stop matching once the day key is gone', () => {
    const db = database()
    createApp(db, sonotas)
    const morning = 10 * DAY + 1000
    const tag = senderTag(db, 'sonotas', 'a', morning)
    expect(tag).toMatch(/^[0-9a-f]{8}$/)
    expect(senderTag(db, 'sonotas', 'a', morning + 60_000)).toBe(tag)
    expect(senderTag(db, 'sonotas', 'b', morning)).not.toBe(tag)
    expect(senderTag(db, 'other', 'a', morning)).not.toBe(tag)
    expect(senderTag(db, 'sonotas', 'a', morning + DAY)).not.toBe(tag)
    const id = addFeedback(db, 'sonotas', submission(), { ...NOTHING, sender: tag })
    expect(getFeedback(db, 'sonotas', id)?.sender).toBe(tag)
    expect(sameSenderCount(db, getFeedback(db, 'sonotas', id)!)).toBe(0)
    const other = addFeedback(db, 'sonotas', submission(), { ...NOTHING, sender: tag })
    expect(sameSenderCount(db, getFeedback(db, 'sonotas', id)!)).toBe(1)
    db.prepare('DELETE FROM feedback WHERE id = ?').run(other)
    expect(sameSenderCount(db, getFeedback(db, 'sonotas', id)!)).toBe(0)
    pruneSenderKeys(db, morning + DAY)
    expect(senderTag(db, 'sonotas', 'a', morning)).not.toBe(tag)
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
