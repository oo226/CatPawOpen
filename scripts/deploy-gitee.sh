#!/usr/bin/env bash
# Push local deploy/ tree (or NODEJS_DIST_DIR) to Gitee branch "dist".
# Requires: GITEE_TOKEN, GITEE_OWNER. Optional: GITEE_REPO (default CatPawOpen).
set -euo pipefail

OWNER="${GITEE_OWNER:?GITEE_OWNER required}"
REPO="${GITEE_REPO:-CatPawOpen}"
TOKEN="${GITEE_TOKEN:?GITEE_TOKEN required}"
SRC="${1:-deploy}"

if [[ ! -d "$SRC" ]]; then
  echo "missing deploy dir: $SRC" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp -a "$SRC"/. "$TMP"/
cd "$TMP"
git init -q
git checkout -b dist
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add .
git commit -q -m "deploy: gitee $(date -u +%Y-%m-%dT%H:%M:%SZ)"

REMOTE="https://${OWNER}:${TOKEN}@gitee.com/${OWNER}/${REPO}.git"
echo "pushing to gitee.com/${OWNER}/${REPO} (branch dist) ..."
git push --force "$REMOTE" dist

echo "OK — CN source:"
echo "https://gitee.com/${OWNER}/${REPO}/raw/dist/nodejs/dist/index.js.md5"
