# collatas

Feedback from every site, in one place. Embed a form, read what people tell you.

**collatas is a module for [nexitas](https://github.com/sovrin/nexitas), not an app of its own.** It ships inside
nexitas, which builds it in from its `modules.json`, and an install's owner
switches it on as Feedback. To use it, install nexitas. nexitas brings the sign-in, the page
shell, the database and the projects (each site's name and origins); collatas adds:

- a form component a project's pages embed, and the public API it sends to;
- the inbox where the owner reads, sorts and answers feedback, across every project;
- a Feedback panel on each project's page: start collecting, the snippet, the form's settings.

## How it fits together

```
site (e.g. sonotas) ── GET  /v1/apps/<id>/form      → the form's rules and a form token
                     ── POST /v1/apps/<id>/feedback  → stored, if the rules allow it
owner               ── /feedback                     the inbox, and each feedback (signed in)
                     ── /projects/<id>                Collect feedback, the snippet, Form settings
```

- **Each project collects feedback on its page** (Collect feedback, then Form settings): its
  sites (origins), set on the project, may show the form; the app's own settings are which kinds it
  offers (a problem, an idea, something else), which context fields the
  site may send along (e.g. `version`), whether it sends the address of the page the form is on
  (so each feedback can open it), a GitHub repository for a prefilled issue, and how long done
  and spam feedback is kept.
- **The form component** comes from collatas itself and takes its look from the site's aequitas
  styles. The project's page shows the snippet to embed:

  ```html
  <script type="module" src="https://nexitas.example.com/v1/form.js"></script>
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

collatas has no app, build or image of its own: it runs inside nexitas. Check out nexitas,
aequitas and collatas next to each other, build aequitas once
(`cd ../aequitas && pnpm install && pnpm build`), and put this checkout into nexitas' modules:

```sh
pnpm install
ln -s ../../collatas ../nexitas/.modules/collatas
cd ../nexitas && pnpm modules && pnpm install && pnpm dev
```

`pnpm modules` fetches the other modules nexitas lists and leaves the symlink to this checkout as
it is. Open http://localhost:3000, create the owner with the key in nexitas' `.data/bootstrap-token`,
and switch Feedback on, at setup or under Modules. The typecheck of the pages and server runs in
nexitas (`pnpm check` there); here `pnpm check` covers the form component and the unit tests.

## In an install

collatas runs wherever nexitas does: see nexitas' README for Compose, the proxy and the settings.
Off (under Modules), its inbox, API and form routes answer 404 and its cleanup stops; its feedback
is kept.

The proxy in front must append the caller's address to `X-Forwarded-For`; the rate limits count
senders by its last entry, the feedback limits kept only as a keyed hash and the sign-in limit only
in memory.

Each app also caps what it holds: by default messages of at most 1024 characters, at most 1000
entries and 512 MB of text. A full app's form turns feedback away until some is deleted or expires,
so a flood cannot fill the disk; the project page marks it `full`. Each limit is set per app.

Feedback of every status is deleted after its app's retention (180 days unless set, at most 3650),
counted from its last change, by nexitas' hourly run while collatas is on. Each feedback shows a
short sender tag, the same for one sender's feedback to one app on one UTC day; its key is deleted
the next day, after which the tag leads back to no one. The inbox searches messages, emails, sender
tags, context and pages; a sender tag links to its search.

## Webhook

Set `COLLATAS_WEBHOOK_URL` and every new feedback is posted there as JSON, once, without waiting
for an answer; a failed delivery is logged and not retried. The sender's email stays out. Fields
are only ever added:

```json
{
  "event": "feedback.new",
  "id": "…",
  "app": { "id": "…", "name": "Shop" },
  "kind": "bug",
  "message": "…",
  "context": { "version": "1.2.0" },
  "page": "https://shop.example.com/checkout",
  "url": "https://nexitas.example.com/feedback/…"
}
```

[ntfy](https://docs.ntfy.sh/publish/#message-templating) turns it into a notification with its
inline templates; `auth` is `Bearer <token>` in base64 without the trailing `=`:

```
https://ntfy.example.com/collatas?tpl=yes&t={{.kind}}%20for%20{{.app.name}}&m={{.message}}&auth=…
```

## Checks

```sh
pnpm check         # the form component's typecheck and the unit tests
pnpm lint
pnpm format:check
node ../aequitas/dist/aequitas-check.mjs --css app/assets/app.css --css ../nexitas/app/assets/nexitas.css app/**/*.vue
```
