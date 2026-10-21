import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// collatas is a module for nexitas: a Nuxt layer that nexitas extends, next to the other modules.
// The owner's sign-in, the /api guard, live updates, the database, the projects and the page shell
// are nexitas'. This config holds only collatas' own part; nexitas builds it (see package.json).
// Paths resolve from here, not from the app, since nexitas is the app.
const root = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2026-09-06',
  css: [resolve(root, 'app/assets/app.css')],
  // nexitas allows its own files and aequitas'; these are collatas' own.
  vite: { server: { fs: { allow: [root] } } },
  // The form is bundled on its own (public/v1/form.js): built with every build of nexitas that
  // includes collatas, from wherever it runs.
  hooks: {
    'build:before': () => {
      execFileSync('pnpm', ['build:widget'], { cwd: root, stdio: 'inherit' })
    },
  },
  routeRules: {
    // The form component is loaded by other sites as a module script, which browsers fetch
    // with CORS. It is public code; a short cache lets a fix reach every app within minutes.
    '/v1/form.js': {
      headers: { 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
    },
  },
})
