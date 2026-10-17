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

export const MAX_MESSAGE = 5000

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

function isHttpUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
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
          .refine(isOrigin, 'Enter an origin like https://sonotas.sovrin.de, without a path.'),
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
    // Where "Open setup" leads: {key} is replaced with that context value.
    setupUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => !value || isHttpUrl(value), 'Enter an http(s) address or leave it empty.'),
    issueRepo: z
      .string()
      .trim()
      .refine(
        (value) => !value || /^[\w.-]+\/[\w.-]+$/.test(value),
        'Enter owner/repository or leave it empty.',
      ),
    // Done and spam feedback is deleted this many days after its last change; 0 keeps it.
    retentionDays: z.number().int().min(0).max(3650),
    enabled: z.boolean(),
  })
  .strict()
export type AppConfig = z.infer<typeof appConfigSchema>

export interface AppSummary extends AppConfig {
  newCount: number
  totalCount: number
}

/** What a site posts. Context keys and lengths are checked against the app afterwards. */
export const submissionSchema = z
  .object({
    token: z.string().max(200),
    kind: z.enum(KINDS),
    message: z.string().trim().min(1, 'Write a message.').max(MAX_MESSAGE),
    email: z.union([z.literal(''), z.email().max(254)]).optional(),
    context: z.record(z.string(), z.string().max(2000)).optional(),
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
  status: Status
  createdAt: number
  updatedAt: number
}

export interface FeedbackDetail extends FeedbackItem {
  setupLink: string | null
  issueLink: string | null
}

export const statusSchema = z.object({ status: z.enum(STATUSES) }).strict()
