#!/usr/bin/env bash
# =============================================================================
# install-hooks.sh — point this repo's git hooks at scripts/git-hooks/.
#
# Run once after cloning a repo derived from any kima-core template:
#
#   bash scripts/install-hooks.sh
#
# Idempotent. Re-running on an already-configured repo is a no-op.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

HOOK_DIR="scripts/git-hooks"

if [ ! -d "$HOOK_DIR" ]; then
  echo "❌ install-hooks: $HOOK_DIR not found in $REPO_ROOT"
  echo "   Make sure you ran sync-to-derivatives.sh from kima-core first,"
  echo "   or that the template is up to date."
  exit 1
fi

# Make every hook in the directory executable.
chmod +x "$HOOK_DIR"/* 2>/dev/null || true

CURRENT=$(git config --local core.hooksPath 2>/dev/null || echo "")
if [ "$CURRENT" = "$HOOK_DIR" ]; then
  echo "✓ core.hooksPath already set to $HOOK_DIR"
else
  git config --local core.hooksPath "$HOOK_DIR"
  # Read-back verification — observed cases where the first invocation
  # right after `git init` silently no-ops (environment-dependent timing
  # with git config flush). Fail loudly so the user sees it immediately
  # instead of discovering an unguarded commit later.
  ACTUAL=$(git config --local core.hooksPath 2>/dev/null || echo "")
  if [ "$ACTUAL" != "$HOOK_DIR" ]; then
    echo "❌ install-hooks: failed to persist core.hooksPath."
    echo "   Expected: $HOOK_DIR"
    echo "   Got:      ${ACTUAL:-<empty>}"
    echo "   Re-run this script, or set manually:"
    echo "     git config --local core.hooksPath $HOOK_DIR"
    exit 1
  fi
  echo "✓ core.hooksPath set to $HOOK_DIR (verified)"
fi

# Sanity-check: list installed hooks.
echo ""
echo "Active hooks in $HOOK_DIR:"
for f in "$HOOK_DIR"/*; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  case "$base" in
    *.local) continue ;;  # local extensions are sourced, not hooks themselves
  esac
  echo "  - $base"
done

echo ""
echo "Next: run  bash scripts/install-gitleaks.sh  to install the secret scanner."
