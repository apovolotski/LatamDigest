#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_REVISION:?A tested source revision is required}"
: "${LOCK_FILE:?A validated lockfile artifact is required}"
: "${LOCK_SHA256:?The validated artifact hash is required}"
if [[ ! "$LOCK_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Invalid security lockfile hash." >&2
  exit 1
fi
python3 - <<'PY'
import hashlib, os
from pathlib import Path
actual = hashlib.sha256(Path(os.environ['LOCK_FILE']).read_bytes()).hexdigest()
if actual != os.environ['LOCK_SHA256']:
    raise SystemExit('Security lockfile artifact hash mismatch; refusing publication.')
PY
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

for attempt in 1 2 3; do
  git fetch --quiet origin main
  # Feed publications may advance main while validation runs. Changes to tested
  # backend code, manifests or the workflow require a fresh validation instead.
  if ! git diff --quiet "$SOURCE_REVISION" origin/main -- backend .github/workflows/backend-checks.yml; then
    echo 'Backend changed after validation; refusing to publish an untested security update.' >&2
    exit 1
  fi
  git checkout --quiet -B verified-security-update origin/main
  cp "$LOCK_FILE" backend/package-lock.json
  git add backend/package-lock.json
  if git diff --cached --quiet; then
    echo 'Verified security lockfile already matches main; nothing to publish.'
    exit 0
  fi
  git commit --quiet -m 'Apply verified compatible dependency security updates'
  if git push --quiet origin HEAD:main; then
    echo 'Published the exact security lockfile validated by both jobs.'
    exit 0
  fi
done
echo 'Main kept changing; security update requires a fresh run.' >&2
exit 1
