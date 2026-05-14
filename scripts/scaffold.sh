#!/usr/bin/env bash
# scaffold.sh - nuxt-cloudflare-template から新規プロジェクトを生成。
#
# Usage:
#   bash scripts/scaffold.sh <project_name> [target_parent_dir]
#
# 共通ロジックは scripts/scaffold-lib.sh (kima-core から sync 配布)。
# nuxt-cf 固有: rsync + node_modules ハードリンク + wrangler.toml rename + nuxt prepare

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scaffold-lib.sh
source "$SCRIPT_DIR/scaffold-lib.sh"

TEMPLATE_NAME="nuxt-cloudflare-template"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_NAME="${1:-}"
TARGET_PARENT="${2:-$HOME/projects}"
TARGET_DIR="$TARGET_PARENT/$PROJECT_NAME"

_scaffold_validate_name "$PROJECT_NAME"
_scaffold_check_target_clean "$TARGET_DIR"

# Ensure template has node_modules (needed for hardlink trick)
if [[ ! -d "$TEMPLATE_DIR/node_modules" ]]; then
  echo "==> Template node_modules not found; running bun install in template first..."
  (cd "$TEMPLATE_DIR" && bun install)
fi

# nuxt-cf override: rsync (faster, allows excludes) instead of cp -r
echo "==> Copying $TEMPLATE_DIR -> $TARGET_DIR (rsync)"
mkdir -p "$TARGET_DIR"
rsync -a \
  --exclude node_modules \
  --exclude .nuxt \
  --exclude .output \
  --exclude dist \
  --exclude .git \
  --exclude .claude/projects \
  --exclude .claude/settings.local.json \
  --exclude tasks \
  "$TEMPLATE_DIR/" "$TARGET_DIR/"

echo "==> Hard-linking node_modules (instant, no extra disk space)"
cp -al "$TEMPLATE_DIR/node_modules" "$TARGET_DIR/node_modules"

# Force fresh lockfile so the new project's deps resolve from package.json
rm -f "$TARGET_DIR/bun.lock"

_scaffold_rename_package_json "$TARGET_DIR/package.json" "$TEMPLATE_NAME" "$PROJECT_NAME"
# nuxt-cf 固有: deploy script に --project-name 注入
sed -i "s/--commit-dirty=true/--project-name $PROJECT_NAME --commit-dirty=true/" "$TARGET_DIR/package.json"
# nuxt-cf 固有: wrangler.toml の name を置換
echo "==> Renaming wrangler.toml: my-app -> $PROJECT_NAME"
sed -i "s/name = \"my-app\"/name = \"$PROJECT_NAME\"/" "$TARGET_DIR/wrangler.toml"

_scaffold_rewrite_readme_h1 "$TARGET_DIR/README.md" "$PROJECT_NAME"
_scaffold_create_tasks "$TARGET_DIR"

echo "==> bunx nuxt prepare (generate .nuxt types)"
(cd "$TARGET_DIR" && bunx nuxt prepare)

_scaffold_git_init "$TARGET_DIR" "$TEMPLATE_NAME"

_scaffold_print_done "$TARGET_DIR" "$TEMPLATE_NAME" "  1. cd $TARGET_DIR
  2. bun dev   # http://localhost:3000
  3. .env.example -> .env (if needed)
  4. Update README L3+ with project description
  5. Customize CLAUDE.md '### $TEMPLATE_NAME 固有' -> '### $PROJECT_NAME 固有' section"
