#!/usr/bin/env bash
# scaffold-test.sh - scaffold.sh が end-to-end で動くか検証する。
#
# Usage:
#   bash scripts/scaffold-test.sh
#
# 動作:
#   1. /tmp に test 用 parent dir を作る
#   2. scaffold.sh を呼ぶ
#   3. 必須ファイル (package.json / tasks/todo.md / .git) の存在を確認
#   4. package.json の name / README L1 が置換されているか確認
#   5. テスト終了時に必ず cleanup
#
# CI で実行することで「scaffold が壊れていないか」を機械的に保証する。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NAME="scaffold-test-$$"
TEST_PARENT=$(mktemp -d)
TEST_TARGET="$TEST_PARENT/$TEST_NAME"

cleanup() {
  rm -rf "$TEST_PARENT"
}
trap cleanup EXIT

echo "==> Running scaffold.sh ($TEST_NAME -> $TEST_TARGET)"
bash "$SCRIPT_DIR/scaffold.sh" "$TEST_NAME" "$TEST_PARENT" >/dev/null

echo "==> Asserting scaffolded structure"
fail=0
assert_exists() {
  if [[ ! -e "$TEST_TARGET/$1" ]]; then
    echo "  FAIL: missing $1"
    fail=1
  else
    echo "  OK: $1"
  fi
}
assert_grep() {
  if ! grep -qF "$2" "$TEST_TARGET/$1"; then
    echo "  FAIL: $1 does not contain '$2'"
    fail=1
  else
    echo "  OK: $1 contains '$2'"
  fi
}

assert_exists "package.json"
assert_exists "README.md"
assert_exists "CLAUDE.md"
assert_exists ".git"
assert_exists "tasks/todo.md"
assert_exists "tasks/lessons.md"
assert_grep "package.json" "\"name\": \"$TEST_NAME\""
assert_grep "README.md" "# $TEST_NAME"

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "FAIL: scaffold-test failed"
  exit 1
fi

echo ""
echo "PASS: scaffold-test"
