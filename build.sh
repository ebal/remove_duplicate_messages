#!/usr/bin/env bash
# Builds dist/remove_duplicate_messages-<version>-tb.xpi inside Docker.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

rm -rf dist
docker build --output type=local,dest=dist .
cat dist/SHA256SUMS
