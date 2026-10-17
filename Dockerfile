ARG NODE_IMAGE=node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
ARG BASE_IMAGE=alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8

FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install --global pnpm@11.15.1
COPY . .
# aequitas is unpublished: Compose passes the sibling checkout's built dist/ as the `aequitas`
# build context (see compose.yaml). Build it there first.
COPY --from=aequitas . /aequitas/dist
ENV AEQUITAS_DIST=/aequitas/dist
RUN pnpm install --frozen-lockfile
RUN pnpm build

# The built server is plain JavaScript with no native modules, so the runtime needs only node:
# its binary from the official image on a bare Alpine, without npm, yarn and corepack. Stripping
# its symbol tables saves ~18 MB; only a native crash backtrace would lose function names.
FROM ${NODE_IMAGE} AS node
RUN apk add --no-cache binutils && strip --strip-all /usr/local/bin/node

FROM ${BASE_IMAGE} AS web
RUN apk add --no-cache libstdc++ \
  && adduser -D -H -u 10001 collatas \
  # A fresh named volume takes this owner, so the server can write its database as non-root.
  && mkdir /data && chown collatas /data
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/.output ./
USER collatas
EXPOSE 3000
CMD ["node", "server/index.mjs"]
