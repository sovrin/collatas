# Agent notes for collatas

Conventions for working on collatas, in code and in the interface.

## Code

- collatas is a module for [nexitas](../nexitas): a plain Nuxt layer that nexitas extends. The
  owner's sign-in, the `/api` guard, live updates, the database, the projects (name and sites) and
  the page shell are there, and plug-in points are its interfaces (`shared/modules.ts`). collatas
  registers itself in `server/core/module.ts` and shows its part of a project in
  `app/components/global/CollatasProject.vue`. What every app needs belongs in nexitas; what only
  collatas needs, here.
- Import by relative path: `~` and `#shared` resolve against nexitas, the app. The core is
  `#nexitas/...`. Nothing app-wide here (name, logo, favicon, sign-in lines): those are nexitas'.
- Its pages live under its own paths (`/feedback`, `/apps/<id>`); `/` and `/projects` are
  nexitas'.
- Keep comprehension debt low: explicit control flow, small modules, framework conventions, no
  speculative abstractions. Comments say why, not what.
- Every rule about input lives once, in `shared/contracts.ts` (zod), and is checked at runtime on
  the server. The admin pages use the same schemas.
- Data access is plain SQL in `server/core/*.ts`: functions that take the database first, no ORM.
  Schema changes are a new step in `migrations` in `server/core/module.ts`; never edit a released
  step.
- `/api/*` is the admin's (nexitas' security middleware): owner session plus the exact
  `COLLATAS_ORIGIN`. `/v1/*` is public and
  versioned: the form component in sites already out there depends on it, so it only grows (new
  fields optional, nothing renamed or removed). Its CORS and origin rules are the `cors` guard
  of its public routes in `server/core/module.ts`.
- The form component (`widget/`) runs in other people's pages: build DOM with `textContent`,
  never HTML strings, and send only the context fields the app allows.

## UI

- Built only from aequitas: semantic HTML plus its classes, `data-*` variants and ARIA state.
  `app/assets/app.css` holds only what aequitas and nexitas' shell lack, with tokens only.
- The look: one centred small column hanging from the top, compact density, square
  corners, no cards, panels or sidebar. Colour only reports state, always next to a word: `new`
  feedback and a `full` app are the states that need the owner. Identifiers, origins and context values are
  mono. Text actions first, at most one primary button per view.
- Lint changed Vue files: `node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css --css ../nexitas/app/assets/nexitas.css <files>`.

## Checks

`pnpm check`, `pnpm lint` and `pnpm format:check` must stay green here, and `pnpm check` and
`pnpm build` in nexitas with this checkout in its `.modules/`.

## Commits and releases

Commit messages are [conventional](https://www.conventionalcommits.org):
`feat(inbox): …`, `fix: …`, `docs(readme): …`. Give a scope or leave the parentheses out; never
write `feat(): …`. release-please can't parse an empty scope and silently drops the commit from
the next version and the changelog. Before 1.0, `feat` and `fix` bump the patch version and a
change marked `!` the minor. Mark a change that breaks the public `/v1` API or the form
component's embed with `!` (`feat(api)!: …`), since sites already out there depend on them. Don't
edit the version in `package.json` or `CHANGELOG.md` by hand; the release PR does that.
