#!/usr/bin/env bash
# Hourly translation job for an always-on Mac running Claude Code.
# Translates pending items via `claude -p` (subscription, no API key), imports them,
# and pushes the changed content files. docs/ is rebuilt by the GitHub Actions ingest
# workflow on its next run, so this job never touches docs/ and cannot conflict with it.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

APP="${SWEDLINES_APP:-$(cd "$(dirname "$0")/.." && pwd)}"
CONTENT="${SWEDLINES_CONTENT:-$APP/content-repo}"
DAYS="${SWEDLINES_TRANSLATE_DAYS:-3}"
BATCH="${SWEDLINES_TRANSLATE_BATCH:-25}"
MODEL_LABEL="${SWEDLINES_CLAUDE_MODEL_LABEL:-claude-code-headless}"
LOCK="/tmp/swedlines-translate.lock"
PROMPT="$APP/prompts/translate-headless.md"

log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }

if ! mkdir "$LOCK" 2>/dev/null; then
  log "another run is in progress ($LOCK exists); exiting"
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

cd "$APP"
log "pulling content repo"
git -C "$CONTENT" pull -q --rebase

WORK="$(mktemp -d /tmp/swedlines-translate.XXXXXX)"
npm run cli --silent -- translate-export --content "$CONTENT" --days "$DAYS" --out "$WORK" --batch-size "$BATCH"

shopt -s nullglob
applied=0
failed=0
for batch in "$WORK"/batch-*.json; do
  out="${batch/batch-/out-}"
  log "translating $(basename "$batch")"
  if ! { cat "$PROMPT"; printf '\n\nTranslate and categorise these items:\n'; cat "$batch"; } \
       | claude -p --output-format text --no-session-persistence > "$out.raw" 2>"$out.err"; then
    log "claude -p failed for $(basename "$batch"): $(head -c 300 "$out.err")"
    failed=$((failed + 1))
    continue
  fi
  # Strip markdown fences if the model added any, keep only the JSON object.
  python3 -I - "$out.raw" "$out" <<'PY'
import json, re, sys
raw = open(sys.argv[1], encoding="utf8").read()
m = re.search(r"\{.*\}", raw, re.S)
if not m:
    sys.exit("no JSON object in output")
data = json.loads(m.group(0))
json.dump(data, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False)
PY
  if npm run cli --silent -- translate-import --content "$CONTENT" --in "$out" --provider claude-code --model "$MODEL_LABEL" | tee -a "$WORK/import.log"; then
    applied=$((applied + 1))
  else
    log "import failed for $(basename "$out")"
    failed=$((failed + 1))
  fi
done

if [ -z "$(git -C "$CONTENT" status --porcelain content)" ]; then
  log "nothing to commit (batches ok=$applied failed=$failed)"
  rm -rf "$WORK"
  exit 0
fi

count=$(git -C "$CONTENT" status --porcelain content | wc -l | tr -d ' ')
git -C "$CONTENT" add content
git -C "$CONTENT" commit -q -m "translate: $count items to English (claude-code, local) $(date -u +%Y-%m-%dT%H:%M:%SZ)"
for attempt in 1 2 3; do
  if git -C "$CONTENT" pull -q --rebase && git -C "$CONTENT" push -q; then
    log "pushed $count translated items (batches ok=$applied failed=$failed)"
    rm -rf "$WORK"
    exit 0
  fi
  log "push attempt $attempt failed; retrying"
  sleep 10
done
log "push failed after 3 attempts; commit left in $CONTENT"
exit 1
