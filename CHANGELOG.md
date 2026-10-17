# Changelog

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
