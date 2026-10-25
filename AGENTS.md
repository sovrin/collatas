# Agent notes for collatas

collatas is a module for [nexitas](../nexitas): a plain Nuxt layer that nexitas extends. The
conventions every module shares (code, project scoping, what the core gives a module, the UI
patterns, checks, commits) are in [nexitas' AGENTS.md](../nexitas/AGENTS.md); follow them here.
These are collatas' own.

## Code

- collatas registers itself in `server/core/module.ts`. It is set up on its inbox: Collect
  feedback while the project has no form, then Setup (`?setup`, in `app/components/InboxList.vue`)
  with the snippet, the form's settings and its deletion.
- Its pages are under `/p/<project>/feedback`, its owner API under `/api/p/<project>/feedback`
  (the form and its settings at `…/feedback/form`). A project's app is found from the project, never
  named in a URL, and the core functions that read or change one feedback take the project and
  find no other's.
- Every rule about input lives once, in `shared/contracts.ts` (zod), and is checked at runtime on
  the server. The admin pages use the same schemas.
- Schema changes are a new step in `migrations` in `server/core/module.ts`; never edit a released
  step.
- `/v1/*` is public and versioned: the form component in sites already out there depends on it,
  so it only grows (new fields optional, nothing renamed or removed). Its CORS and origin rules
  are the `cors` guard of its public routes in `server/core/module.ts`, on the core's
  `projectCors`.
- The form component (`widget/`) runs in other people's pages: build DOM with `textContent`,
  never HTML strings, and send only the context fields the app allows.

## UI

- `new` feedback and a `full` app are the states that need the owner.
- Lint changed Vue files: `node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css --css ../nexitas/app/assets/nexitas.css <files>`.

## Checks

`pnpm check`, `pnpm lint` and `pnpm format:check` must stay green here, and `pnpm check` and
`pnpm build` in nexitas with this checkout in its `.modules/`.

## Commits and releases

As in nexitas, with scopes like `feat(inbox): …`. Mark a change that breaks the public `/v1` API
or the form component's embed with `!` (`feat(api)!: …`), since sites already out there depend on
them.
