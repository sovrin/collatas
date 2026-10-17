import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const dataDir = resolve(process.env.COLLATAS_DATA_DIR || '.data')
mkdirSync(dataDir, { recursive: true, mode: 0o700 })
const tokenPath = resolve(dataDir, 'bootstrap-token')
if (!process.env.COLLATAS_BOOTSTRAP_TOKEN && !existsSync(tokenPath))
  writeFileSync(tokenPath, randomBytes(32).toString('base64url'), { mode: 0o600 })
const port = process.env.PORT || '3000'
const env = {
  ...process.env,
  COLLATAS_DATA_DIR: dataDir,
  COLLATAS_ORIGIN: process.env.COLLATAS_ORIGIN || `http://localhost:${port}`,
  COLLATAS_BOOTSTRAP_TOKEN:
    process.env.COLLATAS_BOOTSTRAP_TOKEN || readFileSync(tokenPath, 'utf8').trim(),
}
console.info(`collatas development: ${env.COLLATAS_ORIGIN}`)
console.info(
  `Initial setup key: ${process.env.COLLATAS_BOOTSTRAP_TOKEN ? 'configured in environment' : tokenPath}`,
)
const child = spawn('pnpm', ['exec', 'nuxt', 'dev', '--host', '127.0.0.1', '--port', port], {
  env,
  stdio: 'inherit',
})
const stop = () => child.kill('SIGTERM')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
child.on('exit', (code) => process.exit(code ?? 0))
