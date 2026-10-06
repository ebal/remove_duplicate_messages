# syntax=docker/dockerfile:1
#
# Reproducible build of the Remove Duplicate Messages MailExtension.
#
#   docker build --output dist .
#
# The base image is pinned by digest and the archive is created with fixed
# timestamps, permissions and file order, so the same sources always give a
# byte-identical .xpi.

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build

RUN apk add --no-cache zip=3.0-r13

WORKDIR /work
COPY legacy/locale legacy/locale
COPY tools tools
COPY test test
COPY src src

# 1. syntax check, 2. unit tests, 3. the committed locales must match what the
# converter generates from the legacy locale files.
RUN set -eu; \
    for f in $(find src tools test -name '*.js'); do node --check "$f"; done; \
    for f in $(find src -name '*.json'); do node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$f"; done; \
    node --test test/*.test.js; \
    node tools/convert-locales.js legacy/locale /tmp/_locales >/dev/null; \
    diff -r /tmp/_locales src/_locales

# 1980-01-01 is the earliest date a zip archive can store.
ENV TZ=UTC
RUN set -eu; \
    version=$(node -p 'require("./src/manifest.json").version'); \
    mkdir /out; \
    cd src; \
    find . -type d -exec chmod 755 {} +; \
    find . -type f -exec chmod 644 {} +; \
    find . -exec touch -h -d '1980-01-01 00:00:00' {} +; \
    find . -type f | LC_ALL=C sort | sed 's|^\./||' \
      | zip -X -9 -q -@ "/out/remove_duplicate_messages-${version}-tb.xpi"; \
    cd /out; \
    sha256sum *.xpi > SHA256SUMS; \
    cat SHA256SUMS

FROM scratch
COPY --from=build /out/ /
