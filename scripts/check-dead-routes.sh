#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════
# scripts/check-dead-routes.sh — Fail CI on dead navigation targets
# ═════════════════════════════════════════════════════════════════════════════
#
# Greps every navigation.navigate("X") / .push("X") / .replace("X") call
# across screens/, components/, context/, hooks/ for the string-literal route
# name X. Compares against the canonical route list in lib/routes.ts. Fails
# if any literal isn't a known route.
#
# Catches the bug class doc/audit/32 was about:
#   navigation.navigate("AddPaymentMethod")  // typo, no such screen — runtime no-op
#   navigation.navigate("CirclesTab")         // wrong name, should be "Circles"
#   navigation.navigate("WebView")            // never registered
#
# Migrated call sites that use Routes.X (instead of "X" literal) are skipped
# — those are already type-checked at compile time by TypeScript.
#
# Usage:
#   bash scripts/check-dead-routes.sh
#
# Exit code:
#   0 — all string-literal nav targets are known routes
#   1 — at least one unknown route name found; the unknown targets and their
#       call sites are printed before exit.
#
# Run in CI; run locally before any commit that touches navigation.
# ═════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Repo root: this script lives in scripts/, so .. is the project root.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ROUTES_FILE="lib/routes.ts"
if [ ! -f "$ROUTES_FILE" ]; then
  echo "ERROR: $ROUTES_FILE not found. Run from repo root." >&2
  exit 2
fi

# Extract every route VALUE (the string after the colon) from lib/routes.ts.
# Lines look like:    AboutApp: "AboutApp",
# We want "AboutApp"; strip quotes for comparison.
KNOWN_ROUTES=$(
  grep -E '^\s+[A-Za-z]+:\s*"[A-Za-z]+"' "$ROUTES_FILE" \
    | grep -oE '"[A-Za-z]+"' \
    | tr -d '"' \
    | sort -u
)

if [ -z "$KNOWN_ROUTES" ]; then
  echo "ERROR: extracted zero routes from $ROUTES_FILE." >&2
  echo "Has the file been edited away from the standard 'Name: \"Name\",' shape?" >&2
  exit 2
fi

# Extract every string-literal nav target from the codebase.
# Matches: navigation.navigate("Foo"     // and ('Foo' too via second pattern)
#          navigation.push("Foo"
#          navigation.replace("Foo"
NAV_TARGETS=$(
  grep -rhoE 'navigation\.(navigate|push|replace)\(\s*"[A-Za-z]+"' \
    screens/ components/ context/ hooks/ 2>/dev/null \
    | grep -oE '"[A-Za-z]+"' \
    | tr -d '"' \
    | sort -u
)

# Also single-quoted form, just in case.
NAV_TARGETS_SQ=$(
  grep -rhoE "navigation\.(navigate|push|replace)\(\s*'[A-Za-z]+'" \
    screens/ components/ context/ hooks/ 2>/dev/null \
    | grep -oE "'[A-Za-z]+'" \
    | tr -d "'" \
    | sort -u
)

ALL_TARGETS=$(echo -e "${NAV_TARGETS}\n${NAV_TARGETS_SQ}" | grep -v '^$' | sort -u)

# Set difference: targets that aren't in known routes.
DEAD=$(comm -23 <(echo "$ALL_TARGETS") <(echo "$KNOWN_ROUTES"))

if [ -z "$DEAD" ]; then
  echo "OK: all $(echo "$ALL_TARGETS" | wc -l | tr -d ' ') string-literal nav targets resolve to known routes in $ROUTES_FILE."
  exit 0
fi

echo "FAIL: the following nav targets are not in $ROUTES_FILE (dead-route bugs):" >&2
echo "" >&2
for target in $DEAD; do
  echo "  '$target' — referenced by:" >&2
  grep -rnE "navigation\.(navigate|push|replace)\(\s*['\"]${target}['\"]" \
    screens/ components/ context/ hooks/ 2>/dev/null | sed 's/^/    /' >&2
  echo "" >&2
done

echo "Fix each by either:" >&2
echo "  (a) Registering the missing screen in App.tsx AND adding it to $ROUTES_FILE." >&2
echo "  (b) Renaming the navigate(...) call to an existing route." >&2
echo "  (c) Removing the dead button (subject to the 🔴 red-emoji button-removal rule)." >&2
exit 1
