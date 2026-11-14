#!/usr/bin/env bash
# Builds a small, realistic demo repository used for the README / Marketplace screenshots.
# Usage: scripts/screenshots/demo-repo.sh <target-dir>
set -euo pipefail

DIR="${1:?usage: demo-repo.sh <target-dir>}"
rm -rf "$DIR"
mkdir -p "$DIR"
cd "$DIR"
git init -q -b main
git remote add origin https://github.com/acme/workspace.git
git config commit.gpgsign false
git config tag.gpgsign false

NOW=$(date +%s)
CLAUDE="Co-authored-by: Claude <noreply@anthropic.com>"
CURSOR="Co-authored-by: Cursor Agent <cursoragent@cursor.com>"

email_of() {
  case "$1" in
    "Mia Chen") echo mia@example.com ;;
    "Jonas Weber") echo jonas@example.com ;;
    "Priya Natarajan") echo priya@example.com ;;
    *) echo sam@example.com ;;
  esac
}

# touch_files <lines> <file>...  — append some lines so diffs have realistic +/- counts
touch_files() {
  local n=$1
  shift
  for f in "$@"; do
    mkdir -p "$(dirname "$f")"
    for ((i = 0; i < n; i++)); do echo "// $f $RANDOM" >>"$f"; done
  done
  git add -A
}

# commit <minutes-ago> <author> <message> [body...]
commit() {
  local t=$((NOW - $1 * 60)) who=$2 email
  email=$(email_of "$2")
  shift 2
  local args=()
  for m in "$@"; do args+=(-m "$m"); done
  GIT_AUTHOR_NAME="$who" GIT_AUTHOR_EMAIL="$email" GIT_AUTHOR_DATE="@$t" \
    GIT_COMMITTER_NAME="$who" GIT_COMMITTER_EMAIL="$email" GIT_COMMITTER_DATE="@$t" \
    git commit -q --allow-empty "${args[@]}"
}

# merge <minutes-ago> <author> <branch> <subject> <body>
merge() {
  local t=$((NOW - $1 * 60)) who=$2 email
  email=$(email_of "$2")
  GIT_AUTHOR_NAME="$who" GIT_AUTHOR_EMAIL="$email" GIT_AUTHOR_DATE="@$t" \
    GIT_COMMITTER_NAME="$who" GIT_COMMITTER_EMAIL="$email" GIT_COMMITTER_DATE="@$t" \
    git merge -q --no-ff "$3" -m "$4" -m "$5"
}

# Graphite-style stack metadata: graphite <branch> <json>
graphite() {
  local blob
  blob=$(printf '%s' "$2" | git hash-object -w --stdin)
  git update-ref "refs/branch-metadata/$1" "$blob"
}

H=60
D=1440

touch_files 12 package.json README.md tsconfig.json
commit $((11 * D)) "Mia Chen" "chore: initial commit"
touch_files 24 src/api/session.ts src/api/tokens.ts
commit $((10 * D + 300)) "Mia Chen" "feat(api): add session tokens (#4)"
touch_files 30 src/db/schema.ts db/migrations/0001_projects.sql
commit $((10 * D)) "Mia Chen" "feat(db): projects and members tables (#5)"
git tag -a v0.4.0 -m v0.4.0

git checkout -q -b feat/search
touch_files 40 src/search/index.ts
commit $((9 * D)) "Sam Rivera" "feat(search): index project names"
git checkout -q main
touch_files 18 src/auth/refresh.ts src/auth/refresh.test.ts
commit $((8 * D + 200)) "Mia Chen" "fix(auth): refresh tokens before they expire (#9)" "$CLAUDE"
git checkout -q feat/search
touch_files 36 src/search/fuzzy.ts src/search/rank.ts
commit $((8 * D)) "Sam Rivera" "feat(search): fuzzy matching with ranking" "$CLAUDE"
touch_files 22 src/search/fuzzy.test.ts
commit $((7 * D + 200)) "Sam Rivera" "test(search): cover empty queries"
git checkout -q main
merge $((7 * D)) "Mia Chen" feat/search "Merge pull request #7 from acme/feat/search" "feat(search): fuzzy project search"
git branch -q -D feat/search

git checkout -q -b feat/dark-mode
touch_files 28 src/web/theme.css src/web/tokens.ts
commit $((6 * D)) "Priya Natarajan" "feat(web): theme tokens for dark mode"
git checkout -q main
touch_files 16 src/db/batch.ts
commit $((5 * D + 200)) "Sam Rivera" "perf(db): batch inserts in a single transaction (#11)"
git checkout -q feat/dark-mode
touch_files 14 src/web/theme.ts
commit $((5 * D)) "Priya Natarajan" "feat(web): respect prefers-color-scheme" "$CURSOR"
git checkout -q main
touch_files 20 docs/sessions.md
commit $((4 * D)) "Mia Chen" "docs: document the sessions API (#12)"
git tag -a v0.5.0 -m v0.5.0
touch_files 26 src/upload/multipart.ts src/upload/retry.ts src/upload/retry.test.ts
commit $((3 * D + 120)) "Jonas Weber" "fix(upload): retry flaky multipart uploads (#13)" "$CLAUDE"

# A stack of three PRs: billing/models → billing/api → billing/ui
git checkout -q -b billing/models
touch_files 34 src/billing/models.ts src/billing/plans.ts
commit $((3 * D)) "Mia Chen" "feat(billing): plans and invoices models"
touch_files 20 db/migrations/0007_invoices.sql
commit $((2 * D + 300)) "Mia Chen" "feat(billing): migrations for invoices" "$CLAUDE"
git checkout -q -b billing/api
touch_files 44 src/billing/api.ts src/billing/routes.ts
commit $((2 * D)) "Mia Chen" "feat(billing): invoices API" "$CLAUDE"
touch_files 30 src/billing/api.test.ts
commit $((1 * D + 60)) "Mia Chen" "test(billing): API contract tests"
git checkout -q main
touch_files 22 src/web/Nav.tsx src/web/App.tsx
commit $((22 * H)) "Priya Natarajan" "refactor(web): extract nav component (#17)"
git checkout -q billing/api
git checkout -q -b billing/ui
touch_files 52 src/web/billing/Invoices.tsx src/web/billing/InvoiceRow.tsx
commit $((20 * H)) "Mia Chen" "feat(billing): invoices page"
touch_files 12 src/web/billing/currency.ts
commit $((5 * H)) "Mia Chen" "fix(billing): format currency per locale" "$CLAUDE"

git checkout -q main
touch_files 30 src/api/session.ts src/api/expiry.ts src/api/session.test.ts
commit $((3 * H)) "Mia Chen" "feat(api)!: sliding session expiry (#18)" \
  "Sessions now extend while the user is active instead of expiring at a fixed time." \
  "BREAKING CHANGE: \`expiresAt\` is replaced by \`idleTimeout\` in the session config." \
  "$CLAUDE"

graphite billing/models '{"parentBranchName":"main","prInfo":{"number":14,"title":"Billing: plans and invoices models","state":"OPEN"}}'
graphite billing/api '{"parentBranchName":"billing/models","prInfo":{"number":15,"title":"Billing: invoices API","state":"OPEN"}}'
graphite billing/ui '{"parentBranchName":"billing/api","prInfo":{"number":16,"title":"Billing: invoices page","state":"OPEN","isDraft":true}}'
graphite feat/dark-mode '{"parentBranchName":"main","prInfo":{"number":19,"title":"Dark mode","state":"OPEN"}}'

# Leave a couple of uncommitted changes around.
echo "// wip" >>src/api/expiry.ts
echo "// wip" >>src/web/App.tsx
echo "Demo repository ready at $DIR"
