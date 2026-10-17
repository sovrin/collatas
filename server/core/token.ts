// A form token says "this form was fetched from collatas for this app, a moment ago". It is not a
// secret the sender keeps: it makes a bot fetch the form first, wait like a person would, and use
// it within the hour, after which rate limits do the rest.
import { createHmac, timingSafeEqual } from 'node:crypto'

const MIN_AGE = 3 * 1000
const MAX_AGE = 2 * 60 * 60 * 1000

function mac(key: string, appId: string, issuedAt: string) {
  return createHmac('sha256', key).update(`${appId}.${issuedAt}`).digest('base64url')
}

export function issueToken(key: string, appId: string, now = Date.now()) {
  const issuedAt = String(now)
  return `${issuedAt}.${mac(key, appId, issuedAt)}`
}

export type TokenCheck = 'ok' | 'early' | 'invalid'

export function checkToken(key: string, appId: string, token: string, now = Date.now()) {
  const [issuedAt = '', signature = ''] = token.split('.')
  if (!/^\d{1,15}$/.test(issuedAt)) return 'invalid' satisfies TokenCheck
  const expected = Buffer.from(mac(key, appId, issuedAt))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return 'invalid' satisfies TokenCheck
  const age = now - Number(issuedAt)
  if (age < MIN_AGE) return 'early' satisfies TokenCheck
  return (age > MAX_AGE ? 'invalid' : 'ok') satisfies TokenCheck
}
