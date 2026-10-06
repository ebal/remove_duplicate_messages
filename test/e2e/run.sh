#!/usr/bin/env bash
# Runs the end-to-end test against the .xpi in dist/ (build it first).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

xpi=$(ls ../../dist/*.xpi)
docker build -q -t rdm-e2e . >/dev/null
docker run --rm --shm-size=1g \
  -v "$(realpath "$xpi")":/e2e/extension.xpi:ro \
  rdm-e2e /e2e/extension.xpi
