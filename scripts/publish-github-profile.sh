#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_DIR="$ROOT/github-profile"
REPO_NAME="Fitandsleek-Official"
GH="${GH:-/opt/homebrew/bin/gh}"

if [[ ! -f "$PROFILE_DIR/README.md" ]]; then
  echo "Missing $PROFILE_DIR/README.md"
  exit 1
fi

if ! "$GH" auth status >/dev/null 2>&1; then
  echo "Log in to GitHub as @Fitandsleek-Official:"
  "$GH" auth login --hostname github.com --git-protocol ssh --web
fi

logged_in="$("$GH" api user --jq .login)"
if [[ "$logged_in" != "$REPO_NAME" ]]; then
  echo "Warning: logged in as @$logged_in, expected @$REPO_NAME."
  echo "Switch account in the browser, then run: $GH auth logout && $0"
  exit 1
fi

if "$GH" repo view "$REPO_NAME/$REPO_NAME" >/dev/null 2>&1; then
  echo "Repository $REPO_NAME/$REPO_NAME already exists."
else
  "$GH" repo create "$REPO_NAME" --public --description "FitAndSleek GitHub profile README"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

"$GH" auth setup-git >/dev/null 2>&1 || true
git clone "https://github.com/$REPO_NAME/$REPO_NAME.git" "$tmp/repo"
cp "$PROFILE_DIR/README.md" "$tmp/repo/README.md"

cd "$tmp/repo"
git add README.md
if git diff --cached --quiet; then
  echo "README already up to date on GitHub."
else
  git commit -m "Add FitAndSleek GitHub profile README"
  git push origin HEAD
  echo "Published: https://github.com/$REPO_NAME"
fi
