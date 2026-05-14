# Cursor + Claude Code 併用ガイド

本プロジェクトでは **Cursor（エディタ）** と **Claude Code（CLI拡張）** を併用する。
キマ（AI アシスタント）は両方の環境から呼び出されるため、ルールファイルは二重に管理する。

---

## ファイルの役割分担

| ファイル | 読み込み元 | 役割 |
|----------|-----------|------|
| `.cursorrules` | **Cursor** | Cursor のAI機能（Composer / Chat）が読むルール |
| `CLAUDE.md` | **Claude Code** | Claude Code CLI が読むルール |
| `.claude/settings.json` | **Claude Code** | Claude Code の環境変数・フック設定 |
| `.claude/settings.local.json` | **Claude Code** | ローカル権限設定（.gitignore 対象） |
| `.claude/rules/*.md` | **Claude Code** | 条件付きルール（特定ファイル編集時に自動適用） |
| `.claude/skills/*/SKILL.md` | **Claude Code** | スキル定義（/コマンドで呼び出し可能） |
| `.claude/agents/*.md` | **Claude Code** | エージェント定義（チーム分析等） |

---

## ルールの同期方針

`.cursorrules` と `CLAUDE.md` は**同じペルソナ・同じ行動原則**を定義する。

- **ペルソナ（キマ）**: 両方に同じ定義を記載
- **コマンドシステム**: 両方に同じコマンド表を記載
- **品質管理**: 両方に同じコーディング規約を記載
- **思考アルゴリズム**: 両方に同じ思考プロトコルを記載

**差分が出る部分:**
- `.cursorrules` は Cursor 固有の補完アシスト等を含む（コードブロック表示の可否など）
- `CLAUDE.md` は Claude Code 固有のツール制約を含む（Edit/Write ツール使用の強制など）
- `.claude/rules/` のルールファイルは Claude Code のみが読む

---

## セットアップ手順

### 1. Cursor にキマを認識させる + 動作確認

1. `.cursorrules` がプロジェクトルートにあることを確認（自動で読み込まれる、追加設定不要）
2. Cursor の **Composer** または **Chat** を開き、以下を実行して動作確認:
   - 入力例: `kima help` （キマが kima コマンド一覧を表示すれば OK）
   - 入力例: `キマ、このプロジェクトの概要を説明して` （日本語で断定調で応答すれば OK）
3. `.cursorrules` で定義された **Markdown 書式ルール** (絵文字 ✅ / ⬜ / 🔥、表のパイプ前後の半角スペース等) が Markdown ファイル編集時に守られているか抜き打ち確認

### 2. Claude Code をインストール

Cursor の拡張機能から Claude Code をインストールする。
`.claude/` ディレクトリと `CLAUDE.md` が自動で認識される。

### 3. スキルの確認

Claude Code のターミナルで以下を入力して、スキルが認識されているか確認:

```
/kima help
```

---

## 新しいルールを追加する場合

1. **両方に影響するルール**: `.cursorrules` と `CLAUDE.md` の両方を更新
2. **Claude Code のみのルール**: `.claude/rules/` に新ファイルを追加
3. **Cursor のみのルール**: `.cursorrules` のみ更新

---

## .gitignore の注意

以下は**コミットする**（チームで共有する）:
- `.cursorrules`
- `CLAUDE.md`
- `.claude/settings.json`
- `.claude/rules/`
- `.claude/skills/`
- `.claude/agents/`

以下は**コミットしない**（個人設定）:
- `.claude/settings.local.json`
- `.claude/projects/`（メモリファイル）
