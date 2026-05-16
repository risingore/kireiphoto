# Nuxt バージョン bump 時の落とし穴と対処

派生プロジェクト (kireiphoto / nuxt-cloudflare-template / 将来の Nuxt 系派生) で Nuxt の minor / major bump dependabot PR を CI green にする際の運用手順と既知の罠を集約する。

最初の実例: 2026-05-15 kireiphoto PR #12 (Nuxt 4.3.1 → 4.4.5)。同 PR で初めて顕在化した複数の罠を後から nuxt-cloudflare-template にも先回り還元した。

## 対象

- Nuxt 4.x 系の minor / major bump dependabot PR
- Nuxt 4.4+ を採用する全派生プロジェクト
- 派生プロジェクトに本ガイド (`docs/guides/nuxt-version-bumps.md`) を sync 配布した先

## Nuxt 4.4 で発生する 3 つの罠

### 罠 1: TypeScript Configuration Splitting

Nuxt 4.4 で `.nuxt/tsconfig.json` が **per-context な 4 ファイル** に分割された。

| 旧 (Nuxt 4.3 以前) | 新 (Nuxt 4.4+) |
| --- | --- |
| `.nuxt/tsconfig.json` 単一 | `.nuxt/tsconfig.app.json` / `tsconfig.server.json` / `tsconfig.shared.json` / `tsconfig.node.json` |

旧 `tsconfig.json` の `extends "./.nuxt/tsconfig.json"` は分割後の構造に追従しないため、project references 形式に書き換える必要がある。

正しい形:

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

CI / ローカルとも、project references を walk するために `bunx tsc --noEmit` から `bunx tsc -b` (build mode) へ切り替える。`-b` でないと references が無視される。

参考: <https://nuxt.com/docs/4.x/getting-started/upgrade#typescript-configuration-splitting>

### 罠 2: @nuxt/schema の peer hoist で旧版が top-level に残る

`@nuxt/ui` の peer dep が `"@nuxt/schema": "^4.4.2"` のように緩い caret になっていると、bun (および npm) が **古い 4.4.2 を top-level に hoist** することがある。一方 `nuxt@4.4.5` 自身は exact dep `"@nuxt/schema": "4.4.5"` を nested で持つ。

問題: `@nuxt/schema@4.4.2` の dist は `DefineNuxtConfig` 型を export していない。`nuxt/config.d.ts` の型チェーン

```ts
interface DefineNuxtConfig extends _DefineNuxtConfig<NuxtConfig>
```

の `_DefineNuxtConfig` が解決できず、`defineNuxtConfig()` が call signature を失う。CI の tsc は

```text
error TS2349: This expression is not callable.
Type 'DefineNuxtConfig' has no call signatures.
```

で fail する。

**対処:** 派生プロジェクトの `package.json` に `@nuxt/schema` を direct exact pin する。

```json
"dependencies": {
  "@nuxt/schema": "4.4.5",
  "nuxt": "4.4.5",
  ...
}
```

これで bun の hoist が 4.4.5 を top-level に固定する。

参考: <https://github.com/nuxt/nuxt/issues/20221>

### 罠 3: split tsconfig の node context が @types/node を自動採用しない

Nuxt 4.4 で生成される `.nuxt/tsconfig.node.json` は `compilerOptions.types` を `[]` 空配列にする傾向がある。`nuxt.config.ts` の `process.env.XXX` 参照が `Cannot find name 'process'` で落ちる。

**対処は 2 段階:**

1. `@types/node` を `devDependencies` に追加 (型のみ、ランタイムバンドルに乗らない)
2. `nuxt.config.ts` の `typescript.nodeTsConfig.compilerOptions.types: ['node']` を明示

```ts
export default defineNuxtConfig({
  typescript: {
    strict: true,
    shim: false,
    // Nuxt 4.4 split tsconfig: node 文脈に @types/node を明示しないと
    // この config 内の process.env が解決できない。
    nodeTsConfig: {
      compilerOptions: {
        types: ['node']
      }
    }
  }
})
```

**例外:** `nuxt.config.ts` の冒頭で `import { execSync } from 'node:child_process'` のような **`node:` プレフィックス import** がある場合、TypeScript はこれをきっかけに @types/node のグローバルを自動採用する。この場合 `nodeTsConfig` の明示は不要。ただしテンプレを scaffold する側からするとこの「偶発的に動く」状態に依存するのは脆いため、テンプレ default では明示しておく。

## チェックリスト

Nuxt 4.x の minor / major bump dependabot PR を扱う時:

- ⬜ `tsconfig.json` を project references 形式に書き換えたか (罠 1)
- ⬜ `package.json` に `@nuxt/schema` を direct exact pin したか (罠 2)
- ⬜ `nuxt.config.ts` が `process.env` を参照しているなら @types/node + `nodeTsConfig` を入れたか (罠 3)
- ⬜ CI workflow の Type check を `bunx tsc -b` に切り替えたか
- ⬜ ローカルで `rm -rf .nuxt && bunx nuxt prepare && bunx tsc -b` が exit 0 か
- ⬜ ローカルで `bun run build` が成功するか
- ⬜ 派生プロジェクトに既存の進行中変更があるなら、stash で隔離して還元を別 commit にしたか

## 関連 commit

- kireiphoto [`7991adc`](https://github.com/risingore/kireiphoto/commit/7991adc) — fix(nuxt): Nuxt 4.4 の型システム破壊変更に追従し CI を緑にする
- kireiphoto [`9ba2987`](https://github.com/risingore/kireiphoto/commit/9ba2987) — PR #12 squash merge
- nuxt-cloudflare-template `08cf089` (local, GitHub remote 無し) — Nuxt 4.4.5 backport
