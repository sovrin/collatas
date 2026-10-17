// Every rule about what collatas accepts lives here, shared by the admin pages and the server.
import { z } from 'zod'

export const KINDS = ['problem', 'idea', 'other'] as const
export type Kind = (typeof KINDS)[number]
/** How a kind is offered to the people sending feedback. */
export const KIND_LABELS: Record<Kind, string> = {
  problem: 'A problem',
  idea: 'An idea',
  other: 'Something else',
}

export const STATUSES = ['new', 'seen', 'done', 'spam'] as const
export type Status = (typeof STATUSES)[number]

/** The longest message any app may allow; each app sets its own, 1024 unless changed. */
export const MAX_MESSAGE = 5000
/** A new app's limits, each changeable per app. */
export const APP_LIMITS = { maxMessage: 1024, maxFeedback: 1000, maxStorageMb: 512 } as const

export const ownerCredentialsSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12, 'Use at least 12 characters.').max(256),
  })
  .strict()

export const setupSchema = ownerCredentialsSchema.extend({ token: z.string().min(32).max(256) })

export interface AuthStatus {
  setupRequired: boolean
  owner: { email: string } | null
}

/** Scheme, host and port only, as a browser sends it in the Origin header. */
export function isOrigin(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value
  } catch {
    return false
  }
}

export const appIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'Use lowercase letters, digits and dashes.')

export const contextFieldSchema = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-zA-Z0-9]{0,31}$/, 'Start with a letter; letters and digits only.'),
    max: z.number().int().min(1).max(2000),
  })
  .strict()
export type ContextField = z.infer<typeof contextFieldSchema>

export const appConfigSchema = z
  .object({
    id: appIdSchema,
    name: z.string().trim().min(1, 'Give the app a name.').max(60),
    origins: z
      .array(
        z
          .string()
          .trim()
          .transform((value) => value.replace(/\/$/, ''))
          .refine(isOrigin, 'Enter an origin like https://sonotas.example.com, without a path.'),
      )
      .min(1, 'Add the site that shows the form.')
      .max(10),
    kinds: z
      .array(z.enum(KINDS))
      .min(1, 'Offer at least one kind.')
      .refine((kinds) => new Set(kinds).size === kinds.length, 'Each kind once.'),
    context: z
      .array(contextFieldSchema)
      .max(20)
      .refine(
        (fields) => new Set(fields.map((field) => field.key)).size === fields.length,
        'Each context field once.',
      ),
    // Send the address of the page the form is on, so a feedback can open it. Off for an app
    // whose addresses hold private data.
    sendPage: z.boolean(),
    issueRepo: z
      .string()
      .trim()
      .refine(
        (value) => !value || /^[\w.-]+\/[\w.-]+$/.test(value),
        'Enter owner/repository or leave it empty.',
      ),
    // Feedback is deleted this many days after its last change, whatever its status.
    retentionDays: z.number().int().min(1, 'Keep feedback at least a day.').max(3650),
    maxMessage: z.number().int().min(1).max(MAX_MESSAGE, `At most ${MAX_MESSAGE} characters.`),
    // An app holding this many entries, or this much of what people sent, takes no more until
    // some is deleted or expires: the disk cannot fill up, whatever is sent.
    maxFeedback: z.number().int().min(1).max(100_000),
    maxStorageMb: z.number().int().min(1).max(10_240),
    enabled: z.boolean(),
  })
  .strict()
export type AppConfig = z.infer<typeof appConfigSchema>

export interface AppSummary extends AppConfig {
  newCount: number
  totalCount: number
  /** At one of its caps: its form turns feedback away. */
  full: boolean
}

/** What a site posts. Context keys and lengths are checked against the app afterwards. */
export const submissionSchema = z
  .object({
    token: z.string().max(200),
    kind: z.enum(KINDS),
    message: z.string().trim().min(1, 'Write a message.').max(MAX_MESSAGE),
    email: z.union([z.literal(''), z.email().max(254)]).optional(),
    context: z.record(z.string(), z.string().max(2000)).optional(),
    // Where the form was: kept only when the app sends pages and it is on one of its sites.
    page: z.string().max(2000).optional(),
    // A field people never see: anything in it was filled in by a bot.
    website: z.string().max(500).optional(),
  })
  .strict()
export type Submission = z.infer<typeof submissionSchema>

/** What the form component fetches before it renders. */
export interface FormRules {
  app: string
  name: string
  kinds: { value: Kind; label: string }[]
  maxMessage: number
  context: ContextField[]
  sendPage: boolean
  token: string
}

export interface FeedbackItem {
  id: string
  appId: string
  appName: string
  kind: Kind
  message: string
  email: string | null
  context: Record<string, string>
  page: string | null
  /** The same for one sender's feedback to this app on one day; null before it was recorded. */
  sender: string | null
  status: Status
  createdAt: number
  updatedAt: number
}

/** One app in the inbox overview: its counts and newest entries for the current filter. */
export interface InboxGroup {
  appId: string
  appName: string
  newCount: number
  total: number
  items: FeedbackItem[]
}

/** A page of feedback, newest first. */
export interface FeedbackPage {
  items: FeedbackItem[]
  total: number
  newCount: number
  page: number
  pageSize: number
}

export interface FeedbackDetail extends FeedbackItem {
  issueLink: string | null
}

/** What the inbox is searched for: words, each of which must appear. */
export const MAX_SEARCH = 100
export const searchSchema = z.string().trim().max(MAX_SEARCH)

export const statusSchema = z.object({ status: z.enum(STATUSES) }).strict()
