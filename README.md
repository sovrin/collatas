# collatas

Feedback from every app, in one place. Register an app, embed its form, read what people tell you.

collatas is one small service: a public API that the registered sites' forms send to, a form
component they embed, and an admin interface for the owner to read feedback and configure apps.
It is Nuxt, SQLite through `node:sqlite` and aequitas for every pixel, behind your own reverse
proxy.

## How it fits together

```
site (e.g. sonotas) ── GET  /v1/apps/<id>/form      → the form's rules and a form token
                     ── POST /v1/apps/<id>/feedback  → stored, if the rules allow it
owner               ── /                             inbox, feedback, apps (signed in)
```

- **Apps are configured in the admin** (Apps → Add an app): the sites (origins) that may show
  the form, which kinds it offers (a problem, an idea, something else), which context fields the
  site may send along (e.g. `version`, `settings`), a setup address and a GitHub repository for
  the links on each feedback, and how long done and spam feedback is kept.
- **The form component** comes from collatas itself and takes its look from the site's aequitas
  styles. The app page shows the snippet to embed:

  ```html
  <script type="module" src="https://collatas.sovrin.de/v1/form.js"></script>
  <collatas-form app="sonotas"></collatas-form>
  <script>
    document.querySelector('collatas-form').context = { version: '0.2.0' }
  </script>
  ```

  It shows people what is sent along before they send, and offers to copy their message when
  sending fails. It fires `collatas-sent` once a message went through. It renders in the light
  DOM, so a site can restyle it with selectors under `collatas-form`.

- **Abuse:** only the app's own origins get an answer (CORS and an `Origin` check), a form token
  must be at least 3 seconds and at most 2 hours old, a hidden field catches bots, each sender may
  send 5 times per 10 minutes per app, an app takes at most 200 entries a day, and request bodies
  must state their length and stay under 64 KB. Nothing is published: feedback stays in the admin
  until the owner turns it into a GitHub issue ("Make an issue", without the sender's email).

## Develop

Node 24+ and pnpm 11. aequitas is not published yet: check it out next to this repository and
build it once (`cd ../aequitas && pnpm install && pnpm build`), or point `AEQUITAS_DIST` at
another built `dist/`.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. On first run the launcher writes a random installation key to
`.data/bootstrap-token`; use it to create the owner account. `PORT` moves the dev server.

## Run with Docker Compose

Copy `.env.example` to `.env`, set `COLLATAS_BOOTSTRAP_TOKEN` (`openssl rand -hex 32`) and the
public address, `COLLATAS_ORIGIN=https://collatas.sovrin.de`. Then:

```sh
docker compose up -d --build
```

The web service listens on `127.0.0.1:3000` (`COLLATAS_BIND`). TLS and the public address belong
to your reverse proxy: put it, or the network it shares, in an untracked `compose.override.yaml`.
The proxy must set `X-Forwarded-For`, which the per-sender rate limit counts by. The image runs as
an unprivileged user on Alpine with only the node binary (about 130 MB unpacked).

Data lives in the `collatas-data` volume (`collatas.sqlite`); back it up and never
`docker compose down -v`. Forgot the password? `pnpm owner:reset --confirm` (with
`COLLATAS_DATA_DIR` pointing at the data) removes the owner and every session, keeps apps and
feedback, and lets you set up again with the installation key.

## Checks

```sh
pnpm check         # typecheck (app, server, form component) and unit tests
pnpm lint
pnpm format:check
pnpm build
node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css app/**/*.vue
```
