import { resolve } from 'node:path'
import { openDatabase } from '../core/database'

let database: ReturnType<typeof openDatabase> | undefined

export function collatasDatabase() {
  const dataDir = process.env.COLLATAS_DATA_DIR
  if (!dataDir) throw new Error('COLLATAS_DATA_DIR must be set for the web server.')
  return (database ??= openDatabase(resolve(dataDir)))
}

/** Where the admin interface lives; its own requests must come from here. */
export function collatasOrigin() {
  const configured = process.env.COLLATAS_ORIGIN
  if (!configured) throw new Error('COLLATAS_ORIGIN must be set for the web server.')
  return new URL(configured).origin
}
