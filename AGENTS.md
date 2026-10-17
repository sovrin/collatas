# Agent notes for collatas

Conventions for working on collatas, in code and in the interface.

## Code

- Keep comprehension debt low: explicit control flow, small modules, framework conventions, no
  speculative abstractions. Comments say why, not what.
- Every rule about input lives once, in `shared/contracts.ts` (zod), and is checked at runtime on
  the server. The admin pages use the same schemas.
- Data access is plain SQL in `server/core/*.ts`: functions that take the database first, no ORM.
  Schema changes are a new `PRAGMA user_version` step in `server/core/database.ts`; never edit a
  released step.
- `/api/*` is the admin's: owner session plus the exact `COLLATAS_ORIGIN`. `/v1/*` is public and
  versioned: the form component in sites already out there depends on it, so it only grows (new
  fields optional, nothing renamed or removed). Its CORS and origin rules are in
  `server/middleware/security.ts`.
- The form component (`widget/`) runs in other people's pages: build DOM with `textContent`,
  never HTML strings, and send only the context fields the app allows.

## UI

- Built only from aequitas: semantic HTML plus its classes, `data-*` variants and ARIA state.
  `app/assets/app.css` holds only what aequitas lacks, with tokens only.
- The look: one centred small column hanging from the top, compact density, square
  corners, no cards, panels or sidebar. Colour only reports state, always next to a word: `new`
  feedback is the one state that needs the owner. Identifiers, origins and context values are
  mono. Text actions first, at most one primary button per view.
- Lint changed Vue files: `node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css <files>`.

## Checks

`pnpm check`, `pnpm lint`, `pnpm format:check` and `pnpm build` must stay green.
