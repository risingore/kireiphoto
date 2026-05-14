#!/usr/bin/env bash
# scaffold-lib.sh - 派生プロジェクト生成の共通ロジック (関数ライブラリ)。
#
# このファイルは kima-core から各派生テンプレに sync で配布される
# (target: <template>/scripts/scaffold-lib.sh)。
# 派生テンプレ側の scripts/scaffold.sh はこれを source して呼び出すだけにする。
#
# 提供関数:
#   _scaffold_validate_name <name>
#   _scaffold_check_target_clean <target_dir>
#   _scaffold_cp <src_dir> <dst_dir>
#   _scaffold_clean_residue <target_dir> [extra_dir...]
#   _scaffold_rename_package_json <file> <old_name> <new_name>
#   _scaffold_rewrite_readme_h1 <file> <new_h1>
#   _scaffold_create_tasks <target_dir>
#   _scaffold_git_init <target_dir> <template_name>
#   _scaffold_print_done <target_dir> <template_name> <next_steps_block>
#
# 規約: テンプレ固有の動作 (rsync vs cp、wrangler.toml の rename 等) は
# 派生テンプレ側 scaffold.sh で扱う。共通操作のみここに置く。

set -euo pipefail

# project name は英小文字・数字・ハイフンのみ
_SCAFFOLD_VALID_NAME='^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'

_scaffold_validate_name() {
  local name="${1:-}"
  if [[ -z "$name" ]]; then
    echo "ERROR: project name is required" >&2
    return 1
  fi
  if ! [[ "$name" =~ $_SCAFFOLD_VALID_NAME ]]; then
    echo "ERROR: project name must be lowercase letters / digits / hyphens only: $name" >&2
    return 1
  fi
}

_scaffold_check_target_clean() {
  local target="$1"
  if [[ -e "$target" ]]; then
    echo "ERROR: target already exists: $target" >&2
    return 1
  fi
}

_scaffold_cp() {
  local src="$1" dst="$2"
  echo "==> Copying $src -> $dst"
  cp -r "$src" "$dst"
}

# Remove kima governance / build residue from a freshly-copied target.
# Always removes: .git, node_modules, dist, .claude/projects, .claude/settings.local.json, tasks, scripts/scaffold-test.sh
# Additional dirs to remove can be passed as extra args.
_scaffold_clean_residue() {
  local target="$1"
  shift
  local default_clean=(
    ".git"
    "node_modules"
    "dist"
    ".claude/projects"
    ".claude/settings.local.json"
    "tasks"
    "scripts/scaffold-test.sh"
  )
  echo "==> Cleaning residue: ${default_clean[*]} $*"
  local d
  for d in "${default_clean[@]}" "$@"; do
    rm -rf "$target/$d" 2>/dev/null || true
  done
}

_scaffold_rename_package_json() {
  local file="$1" old_name="$2" new_name="$3"
  if [[ ! -f "$file" ]]; then return 0; fi
  echo "==> Renaming $(basename "$file"): $old_name -> $new_name"
  sed -i "s/\"name\": \"$old_name\"/\"name\": \"$new_name\"/" "$file"
}

_scaffold_rewrite_readme_h1() {
  local file="$1" new_h1="$2"
  if [[ ! -f "$file" ]]; then return 0; fi
  echo "==> Rewriting README L1 -> # $new_h1"
  sed -i "1s|.*|# $new_h1|" "$file"
}

_scaffold_create_tasks() {
  local target="$1"
  echo "==> Creating tasks/"
  mkdir -p "$target/tasks"
  cat > "$target/tasks/todo.md" <<'EOF'
# TODO

- 🔥 ⬜ プロジェクト初期セットアップ
- ⬜ 派生プロジェクト固有のカスタマイズ (kima-core/docs/guides/new-project-from-template.md 参照)
EOF
  cat > "$target/tasks/lessons.md" <<'EOF'
# Lessons Learned

（修正・学びをここに記録する）
EOF
}

_scaffold_git_init() {
  local target="$1" template_name="$2"
  echo "==> git init + initial commit"
  (
    cd "$target"
    git init -q
    git add -A
    git commit -q -m "chore: initial commit from $template_name"
  )
}

_scaffold_print_done() {
  local target="$1" template_name="$2"
  local next_steps="${3:-}"
  echo ""
  echo "=== Done ==="
  echo "Project: $target"
  echo "Source : $template_name"
  echo ""
  if [[ -n "$next_steps" ]]; then
    echo "Next steps:"
    echo "$next_steps"
  fi
}
