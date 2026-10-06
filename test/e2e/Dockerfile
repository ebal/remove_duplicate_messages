# syntax=docker/dockerfile:1
#
# End-to-end test: runs the built .xpi inside a real, headless Thunderbird and
# drives it over Marionette. See test/e2e/run.sh.

FROM node:22-bookworm-slim

ARG TB_VERSION=153.4.0esr
ARG TB_SHA256=fa5dc77f6dce0347a9672df86a13df23231a74f9ac5459b935e7e64f83d73428

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils \
      libgtk-3-0 libdbus-glib-1-2 libasound2 libx11-xcb1 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/tb.tar.xz \
      "https://archive.mozilla.org/pub/thunderbird/releases/${TB_VERSION}/linux-x86_64/en-US/thunderbird-${TB_VERSION}.tar.xz" \
    && echo "${TB_SHA256}  /tmp/tb.tar.xz" | sha256sum -c \
    && tar -xJf /tmp/tb.tar.xz -C /opt \
    && rm /tmp/tb.tar.xz

COPY driver.js /e2e/driver.js
ENTRYPOINT ["node", "/e2e/driver.js"]
