# Changelog

## [0.3.0](https://github.com/sovrin/collatas/compare/v0.2.6...v0.3.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* the inbox across all apps, /api/inbox and /api/apps/* are gone; the status hook is gone (nexitas shows projectStatus); webhook links point to /p/<id>/feedback/<entry>.
* run as a module of nexitas, on its shared projects

### Features

* one project's feedback, under its /p/&lt;id&gt; ([24749cb](https://github.com/sovrin/collatas/commit/24749cbdcdadbb1e15eb23dc94af43233206160b))
* run as a module of nexitas, on its shared projects ([3df2205](https://github.com/sovrin/collatas/commit/3df22055a2cae1f281105617a770e3916a1ceb00))
* **setup:** the form is set up on the inbox, not the project's overview ([7d7b44d](https://github.com/sovrin/collatas/commit/7d7b44d00666cb44097d0fdd2fc0fd8a9d9c2b95))
* the console's look: a hue, a sidebar figure and the overview's story ([d2609a9](https://github.com/sovrin/collatas/commit/d2609a91ee9550cd6bc63e6f2fe1d9ef3ae5bb62))
* the section is Feedback, with its form settings a click away ([71eb83f](https://github.com/sovrin/collatas/commit/71eb83f01603d7b6eeda1e302b593e154f2e6639))


### Bug Fixes

* an entry reads before its actions, and the form keeps a measure ([bd3b6f1](https://github.com/sovrin/collatas/commit/bd3b6f1f7cb17fe5288555a285eb23f3c857ecaf))
* build on the core's toolkit, in its UI patterns ([bc41c91](https://github.com/sovrin/collatas/commit/bc41c91c3af21370fa17d530c0bdd8b30c1150fd))
* check against a fully installed nexitas ([4d351e0](https://github.com/sovrin/collatas/commit/4d351e0ae8be7c77a7f65e96572613f4908091bb))
* check against a fully installed nexitas ([f32889d](https://github.com/sovrin/collatas/commit/f32889dba52c5a6c660192b6947ac6cbe8718110))
* draw every page with the core's page kit ([eb31905](https://github.com/sovrin/collatas/commit/eb319050d5bc554e5a28158240691793a6884314))
* **feedback:** say plainly that deleting cannot be undone ([8b7be9f](https://github.com/sovrin/collatas/commit/8b7be9f07473514502a66f126f47aced1e7b622c))
* **security:** store pages without their query, sign the webhook ([da9f5af](https://github.com/sovrin/collatas/commit/da9f5afbcc6d63893e25340e755ef892c5603a7f))
* the inbox and its form load at once ([2f9d022](https://github.com/sovrin/collatas/commit/2f9d02205a070b39cc86e4de41dd2b338145f73d))

## [0.2.6](https://github.com/sovrin/collatas/compare/v0.2.5...v0.2.6) (2026-10-17)


### Features

* **webhook:** post new feedback to COLLATAS_WEBHOOK_URL ([cbfb924](https://github.com/sovrin/collatas/commit/cbfb924f530edf9ecd657e641db3e6332ac81fd1))


### Bug Fixes

* **feedback:** drop the app row the breadcrumb already shows ([b2dc896](https://github.com/sovrin/collatas/commit/b2dc89665e7f7e2e8f552425dba6035ef465eb42))

## [0.2.5](https://github.com/sovrin/collatas/compare/v0.2.4...v0.2.5) (2026-10-17)


### Features

* **form:** credit collatas in the caption, linked to the project ([54af93d](https://github.com/sovrin/collatas/commit/54af93da37302c63f06ed68082c4cb946c4fd088))


### Bug Fixes

* **form:** don't name collatas in errors visitors see ([ceee26a](https://github.com/sovrin/collatas/commit/ceee26ace9c2e131ee67fff4f78b0af0deb2b2a5))

## [0.2.4](https://github.com/sovrin/collatas/compare/v0.2.3...v0.2.4) (2026-10-17)


### Features

* **form:** show characters left under the message ([3a28a00](https://github.com/sovrin/collatas/commit/3a28a00cc487cdf5849f3cb7e7545cf0d4749bea))


### Bug Fixes

* **inbox:** show the sender note only when other feedback shares the tag ([bd86d49](https://github.com/sovrin/collatas/commit/bd86d491fae5c7f6c4ea7aa346322167bb98da72))

## [0.2.3](https://github.com/sovrin/collatas/compare/v0.2.2...v0.2.3) (2026-10-17)


### Features

* **apps:** per-app limits on message length, entries and storage ([354c7b2](https://github.com/sovrin/collatas/commit/354c7b25f7c489769d64956a5f3360f24aef7b0e))
* **feedback:** a short sender tag, the same for one sender on one day ([354c7b2](https://github.com/sovrin/collatas/commit/354c7b25f7c489769d64956a5f3360f24aef7b0e))
* **inbox:** search feedback by words, email, context or sender tag ([354c7b2](https://github.com/sovrin/collatas/commit/354c7b25f7c489769d64956a5f3360f24aef7b0e))


### Bug Fixes

* **form:** load in Vue and Nuxt apps, and fail quietly with a timeout ([b7f6556](https://github.com/sovrin/collatas/commit/b7f65566a25c8bf6dc8ab05404a7da5b72ad1866))
* **security:** count IPv6 senders by their /64, and rate-limit only feedback that is kept ([354c7b2](https://github.com/sovrin/collatas/commit/354c7b25f7c489769d64956a5f3360f24aef7b0e))

## [0.2.2](https://github.com/sovrin/collatas/compare/v0.2.1...v0.2.2) (2026-10-17)


### Features

* **app:** the version in the footer ([6f1be59](https://github.com/sovrin/collatas/commit/6f1be599a9bffa84da8b2399f14823286599179f))

## [0.2.1](https://github.com/sovrin/collatas/compare/v0.2.0...v0.2.1) (2026-10-17)


### Features

* **retention:** feedback of every status is deleted after its app's retention ([f61dcc5](https://github.com/sovrin/collatas/commit/f61dcc52665d5340f70cc799869dad0f77000bec))


### Bug Fixes

* **feedback:** drop the fragment from the page address, where tokens often live ([f61dcc5](https://github.com/sovrin/collatas/commit/f61dcc52665d5340f70cc799869dad0f77000bec))
* **security:** a Content-Security-Policy for objects, base, framing and forms ([f61dcc5](https://github.com/sovrin/collatas/commit/f61dcc52665d5340f70cc799869dad0f77000bec))
* **security:** rate limits per sender, without storing addresses ([f61dcc5](https://github.com/sovrin/collatas/commit/f61dcc52665d5340f70cc799869dad0f77000bec))

## [0.2.0](https://github.com/sovrin/collatas/compare/v0.1.0...v0.2.0) (2026-10-17)


### Features

* **app:** a logo, beside the name and as the favicon ([2b49d52](https://github.com/sovrin/collatas/commit/2b49d52ba8a429780ea2c209377d7733f6efa369))
* **app:** calm transitions between pages and as feedback arrives ([a582643](https://github.com/sovrin/collatas/commit/a582643c9bab95232d5cad3347c5ee077f46151a))
* **feedback:** open the page a feedback was sent from ([15bdd15](https://github.com/sovrin/collatas/commit/15bdd155df063e51c4985013036fc3e5370e0665))
* **inbox:** feedback grouped by app, and paged within an app ([7ba5ada](https://github.com/sovrin/collatas/commit/7ba5ada365415ebe3a87c10371c3b2403fada589))
* **inbox:** new feedback appears as it arrives ([97e58e3](https://github.com/sovrin/collatas/commit/97e58e3c59870e4a32a6dbe474251fb41ec580c8))
