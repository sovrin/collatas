// Forgot the owner password? Removes the owner and every session, so /setup runs again with
// the installation key. Feedback and apps stay.
//   pnpm owner:reset --confirm
//   docker compose exec web node -e …   (or run this script against the data volume)
import { resolve } from 'node:path'
import { resetOwner } from '../server/core/auth'
import { openDatabase } from '../server/core/database'

if (!process.argv.includes('--confirm')) {
  console.error('This signs out the owner and allows a new setup. Run it with --confirm.')
  process.exit(1)
}
resetOwner(openDatabase(resolve(process.env.COLLATAS_DATA_DIR || '.data')))
console.info('The owner is removed. Open collatas to set it up again.')
