#!/usr/bin/env bash
#
# Runs the author-profile unit tests.
#
# Usage:
#   tests/author-profile/run.sh

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec node "$repo_root/tests/author-profile/run.js"
