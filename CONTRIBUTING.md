# Contributing

ありがとう / Thanks for your interest. このリポジトリは個人プロジェクトとして運用されているため、貢献の受け入れは限定的です。

## 受け入れる貢献

- バグ修正 (再現手順付き)
- typo / ドキュメント改善
- 既存 issue への解決提案

## 受け入れない貢献

- 大規模な機能追加 (事前に issue で議論してください)
- スタイル変更のみの PR
- 自動生成 PR (Dependabot を除く)

## 開発フロー

1. Issue を立てて方針を確認 (新機能 / 大きい変更の場合)
2. fork → ブランチ作成 → 実装
3. 初回 clone 後: secret scanning hooks を有効化
   ```bash
   bash scripts/install-hooks.sh      # core.hooksPath を scripts/git-hooks/ に切替
   bash scripts/install-gitleaks.sh   # ~/.local/bin/gitleaks を install (既存なら skip)
   ```
   詳細運用は `.claude/rules/git-secret-scanning.md` 参照
4. ローカルでテスト + lint をパス
5. PR テンプレートを埋めて submit
6. レビュー → 修正 → マージ

## コーディング規約

派生プロジェクトのコーディング規約は各プロジェクトの `CLAUDE.md` を参照してください。共通方針:

- 秘密情報はコード / 設定ファイルに直書きしない (環境変数経由)
- マジックナンバー禁止
- 未使用のインポート / 変数を残さない
- lockfile (uv.lock / bun.lock 等) は必ずコミット

## 質問

実装方針が不明な場合は、PR ではなく issue で先に質問してください。
