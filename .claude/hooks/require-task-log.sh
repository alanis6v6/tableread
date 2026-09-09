#!/usr/bin/env bash
set -uo pipefail

INPUT="$(cat)"

if echo "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0

DIRTY="$(git status --porcelain 2>/dev/null)"
AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
AHEAD="${AHEAD:-0}"

if [ -z "$DIRTY" ] && [ "$AHEAD" = "0" ]; then
  exit 0
fi

cat >&2 <<MSG
這個 repo 有還沒記錄的異動（工作目錄有未提交的改動，或本機領先遠端 ${AHEAD} 個 commit 還沒推）。
結束前先到 Notion「任務紀錄」資料庫新增一列：
提示詞精簡版、思路摘要、確切改了哪些檔案、GitHub 連結（commit/PR）。
連結見這個 repo CLAUDE.md 的「任務紀錄」段落，或直接搜尋「任務紀錄」。
寫完再結束即可，這則提醒同一次 Stop 只會擋一次。
MSG
exit 2
