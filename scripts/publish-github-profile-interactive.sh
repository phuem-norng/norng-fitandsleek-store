#!/usr/bin/env bash
set -euo pipefail

GH="${GH:-/opt/homebrew/bin/gh}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== FitAndSleek GitHub Profile Publisher ==="
echo ""

if ! "$GH" auth status >/dev/null 2>&1; then
  echo "Step 1: Log in as @Fitandsleek-Official in the browser."
  echo "        (Do NOT use @phuem-norng — profile must be on the official account.)"
  echo ""
  "$GH" auth login --hostname github.com --git-protocol ssh --web
fi

echo ""
echo "Step 2: Publishing profile README..."
bash "$ROOT/scripts/publish-github-profile.sh"
