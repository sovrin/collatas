import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, expect, it, vi } from 'vitest'
import { sendFeedbackWebhook } from '../../server/utils/webhook'

// The app's name comes from Nuxt's runtime config, which a unit test has no Nuxt to give.
vi.stubGlobal('useRuntimeConfig', () => ({ public: { nexitas: { name: 'collatas' } } }))

afterEach(() => {
  delete process.env.COLLATAS_WEBHOOK_URL
})

it('posts new feedback without the email, and sends nothing when unset', async () => {
  const received = new Promise<{ type?: string; body: unknown }>((resolve) => {
    const server = createServer((request, response) => {
      let body = ''
      request.on('data', (chunk) => (body += chunk))
      request.on('end', () => {
        response.end()
        server.close()
        resolve({ type: request.headers['content-type'], body: JSON.parse(body) })
      })
    })
    server.listen(0, '127.0.0.1', () => {
      process.env.COLLATAS_WEBHOOK_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`
      process.env.COLLATAS_ORIGIN = 'https://collatas.example.com'
      sendFeedbackWebhook(
        { id: 'shop', name: 'Shop' },
        'f1',
        { kind: 'bug', message: 'Broken', email: 'a@example.com', token: 't' },
        { context: { version: '1' }, page: null },
      )
    })
  })
  expect(await received).toEqual({
    type: 'application/json',
    body: {
      event: 'feedback.new',
      id: 'f1',
      app: { id: 'shop', name: 'Shop' },
      kind: 'bug',
      message: 'Broken',
      context: { version: '1' },
      page: null,
      url: 'https://collatas.example.com/feedback/f1',
    },
  })
  delete process.env.COLLATAS_WEBHOOK_URL
  expect(() =>
    sendFeedbackWebhook(
      { id: 'shop', name: 'Shop' },
      'f2',
      { kind: 'bug', message: 'x', token: 't' },
      { context: {}, page: null },
    ),
  ).not.toThrow()
})
