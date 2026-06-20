# kiritan_r 開発効率化 — AI技術・サービス導入提案書

> 作成日: 2026-06-18  
> 対象: `/Users/kamatashintarou/MCP_Learning/kiritan_r/`（React 19 + Vite、ターン制ストラテジーゲーム）  
> 前提: 開発者はシナリオ執筆に専念。コーディングはAI担当。

---

## 優先度マトリクス（まず何をやるか）

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 🔴 今すぐ | GitHub MCP + Claude Code Action | コード変更の安全な管理基盤。他すべての前提 |
| 🔴 今すぐ | Higgsfield MCP（画像生成） | 立ち絵83枚未作成。ゲームが動かない状態 |
| 🟡 1週間以内 | Claude Code + image-gen スキル連携 | 立ち絵をバッチ生成するパイプライン構築 |
| 🟡 1週間以内 | Vitest 自動テスト導入 | コード担当AI（ClaudeCode）がリグレッションを自力検出できるように |
| 🟢 1ヶ月以内 | GitHub Actions CI/CD | PRマージ時に自動ビルド確認 |
| 🟢 1ヶ月以内 | シナリオJSON管理スキル | イベント数増加に伴うミス防止 |

---

## 1. 🔴 GitHub MCP + Claude Code Action（最優先）

### 現状
- `gh` CLIは使用済み（settings.local.jsonに `gh pr *` 許可あり）
- しかし手動PR作成が多く、Cowork ↔ ClaudeCode 間の引き継ぎが口頭/プロンプトファイル頼り

### 導入するもの

**A. GitHub公式MCP Server**

```bash
# Claude Code の .mcp.json に追加
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "<your-token>" }
    }
  }
}
```

これでClaudeCodeが「PRの内容を読む」「CIの結果を確認する」「差分を参照してバグを修正する」をすべて自律的に実行できる。

**B. Claude Code GitHub Action**

```yaml
# .github/workflows/claude.yml
name: Claude Code Review
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

PRを開くと、Claudeが自動でコードレビュー・テスト実行・修正提案を行う。`@claude 修正して` とコメントするだけでコードが変わる。

### 運用フロー（提案）

```
シナリオ作家（あなた）
  → Coworkで「このイベントJSON作って」
  → ClaudeがPR作成
  → GitHub ActionのClaudeが自動レビュー
  → 問題なければ即マージ
```

**参考:** [Claude Code GitHub Actions公式ドキュメント](https://code.claude.com/docs/en/github-actions) / [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)

---

## 2. 🔴 Higgsfield MCP（立ち絵83枚の一括生成）

### 現状（IMAGE_TASKS.md より）
- 必要な立ち絵: 90枚（characters.json全キャラ）
- 現存: わずか7枚（kiritan, una, shuo, zundamon, meron, bern_fog, awamo）
- **CRITICALステータス: 13キャラ以上がイベントに出現するが立ち絵なし**

### 導入するもの

**Higgsfield MCP** — Cowork（このセッション）から直接使える画像生成MCP

```
対応モデル:
- Seedream 5.0（アニメ・スタイライズドアートに強い）
- Flux 2 Pro（クリーンなイラスト・ゲームアートに強い）
- Recraft V4 Pro（ゲームアート・UI向け）
- 30+モデルを切り替えながら使用可能
```

**キャラクター一貫性機能:** 5〜10枚の参照画像からキャラクターモデルをトレーニングし、以降の全生成で顔・衣装・特徴を固定できる。既存7枚を参照画像として登録すれば、残り83枚のスタイルを統一できる。

**セットアップ手順:**
1. Coworkの「プラグイン設定」→ Higgsfield MCP をインストール
2. Higgsfield アカウント作成（https://higgsfield.ai）
3. このセッションで「東北きりたんのスタイルで○○のキャラクター立ち絵を生成して」と指示するだけ

**生成プロンプト例（kiritan_rスタイル向け）:**
```
anime-style character portrait, [キャラ名], [特徴], 
white background, half-body shot, consistent with 
Japanese voiceroid character design, flat-shading illustration,
game UI sprite style, 512x512
```

**参考:** [Higgsfield MCP](https://higgsfield.ai/claude-ai-image-generator) / [Consistent character illustrations with Claude Code and MCP](https://www.aiphotogenerator.net/blog/2026/02/consistent-character-ai-illustrations-claude-code-mcp)

---

## 3. 🟡 既存 image-gen MCP の活用（Cowork内蔵）

### 現状
このCoworkセッションには既に `mcp__image-gen__generate_game_asset` と `mcp__image-gen__generate_image` ツールが内蔵されている。

### 使い方（今すぐ使える）

**バッチ生成スクリプトの作成:**
```
依頼例: 「IMAGE_TASKS.mdのCRITICALキャラクター13名の立ち絵を、
image-gen MCPで順番に生成して public/assets/ に保存して」
```

**背景画像生成:**
- `bg_battle.jpg` 以外の背景（マップ、各拠点）を生成
- 「東北地方の戦国時代の城下町、ゲームUI背景向け」

**活用できるツール:**
- `generate_game_asset`: ゲームアセット特化（スプライト、背景、UIアイコン）
- `generate_image`: 汎用画像生成

---

## 4. 🟡 Vitest 自動テスト導入（ClaudeCode が自力で品質確認）

### 現状の問題
- テストスクリプトが `package.json` に存在しない（`"test"` キーなし）
- BattleEngineV3などのゲームロジックをAIが修正しても、バグを検出する仕組みがない
- QA環境（`?qa=battlefull`）は手動確認のみ

### 導入するもの

```bash
npm install --save-dev vitest @vitest/ui
```

```json
// package.json に追加
"scripts": {
  "test": "vitest run",
  "test:ui": "vitest --ui",
  "test:watch": "vitest"
}
```

**ClaudeCode向けの運用:**
- ClaudeCodeが機能変更前後に `npm test` を自動実行
- GitHub Action に `npm test` を組み込み、テスト失敗PRはマージ不可に設定

**まず書くべきテスト（優先度順）:**
1. `BattleEngineV3.js` — ダメージ計算、SP消費ロジック
2. `EventEngine.js` — イベントトリガー条件の評価
3. `SaveSystem.js` — セーブ/ロードの整合性

**参考:** ClaudeCode は `npm test` の結果を読んでバグを自己修正できる。テストがあるだけで作業品質が大幅向上。

---

## 5. 🟡 Claude Code + Cowork ハイブリッド運用設計

### 役割の明確化（現状の KNOWLEDGE.md との整合）

| 担当 | ツール | 担当範囲 | 引き継ぎ方法 |
|------|--------|---------|------------|
| シナリオ作家 | Cowork（このセッション） | イベントJSON作成、KNOWLEDGE.md更新、調査 | — |
| ClaudeCode | Claude Code CLI | GameContext接続、バグ修正、テスト実行 | `docs/prompts/` にプロンプトファイルを置く |
| ClaudeDesign | Claude（別セッション） | JSX・UIデザイン生成 | PRとして提出 |
| CI | GitHub Actions + Claude | 自動レビュー・テスト | PRトリガー自動起動 |

### Cowork → ClaudeCode の引き継ぎパターン

```markdown
# パターン1: シナリオ追加
Cowork: イベントJSON作成 → docs/prompts/PROMPT_ev_xxx.md 作成
ClaudeCode: プロンプト読み込み → JSON検証 → characters.jsonに立ち絵パス追加 → テスト → PR作成

# パターン2: バグ報告
Cowork: バグ調査・診断 → docs/prompts/BUG_xxx.md に再現手順記録
ClaudeCode: 修正 → npm test → PR作成 → GitHub Actionが自動レビュー

# パターン3: 画像生成
Cowork + Higgsfield MCP: 立ち絵生成 → public/assets/ に保存
ClaudeCode: characters.json に portrait フィールド追加 → 動作確認
```

---

## 6. 🟢 GitHub Actions CI/CD パイプライン

### 推奨構成

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run lint
      - run: npm test          # Vitest（上記で導入後）
      - run: npm run build     # Viteビルド確認

  claude-review:
    needs: test
    uses: anthropics/claude-code-action@v1  # PR時のAIレビュー
```

**効果:** PRを出すだけで「lint → test → build → Claudeレビュー」が全自動。コードに触らない日でも品質が維持される。

---

## 7. 🟢 シナリオJSON管理の効率化

### 現状の課題
- `src/game/data/events/` 以下にJSONが増加中
- `_index.json` の手動更新が必要
- イベント間の整合性チェックが目視頼り

### 推奨アプローチ

**A. Coworkでのスキーマ検証**
```
依頼例: 「events/_index.json と各イベントJSONのconditions/effectsを
全部チェックして、存在しないcharacter IDを参照しているものを報告して」
```

**B. エディタ（localhost:3001）の活用強化**
- 既存の `tools/editor.cjs` + `bulk-input.html` を使ってシナリオの一括入力
- CoworkからEditor APIを呼び出して直接イベント追加も可能

**C. イベントJSON生成プロンプトの標準化**
```
Coworkへの依頼テンプレート:
「以下のシナリオを元に、kiritan_rのイベントJSON形式で書いて。
character IDは characters.json から正確に取得し、
conditions/effectsはEventEngineの仕様に従うこと。
[シナリオ内容をここに貼る]」
```

---

## 8. 補足: 現在すでに使える機能の確認

### Coworkセッション内で今すぐ使えるもの

| ツール | 用途 | 状態 |
|--------|------|------|
| `image-gen MCP` | 立ち絵・背景生成 | ✅ このセッションに組み込み済み |
| `Claude in Chrome MCP` | ゲームのブラウザ動作確認 | ✅ settings.local.jsonに許可済み |
| `filesystem MCP` | ファイル操作 | ✅ 利用可 |
| `gh` CLI | PRの作成・確認 | ✅ 許可済み |
| `WebSearch` | 技術調査 | ✅ このセッションで利用中 |

### すぐ試せるアクション（このセッションで）

1. `「image-gen MCPで portrait_akane.png を生成して public/assets/ に保存して」` → 立ち絵1枚完成
2. `「events/_index.json のキャラクターID整合性チェックをして」` → シナリオバグ発見
3. `「IMAGE_TASKS.md のCRITICALキャラクター全員の立ち絵をバッチ生成して」` → 一気に解消

---

## まとめ：推奨着手順序

```
Week 1:
  [今日] image-gen MCP で CRITICAL立ち絵13枚を生成
  [今日] Higgsfield MCPのインストール確認
  [今週] vitest を npm install して基本テスト3本作成

Week 2:
  GitHub MCP Server を .mcp.json に追加
  .github/workflows/ci.yml 作成（lint + build のみでもOK）
  claude.yml 追加（PR自動レビュー）

Month 1:
  キャラクター全90枚の立ち絵をHiggsfield MCPで生成
  characters.json に portrait フィールドを全員分追加
  シナリオJSON生成の依頼テンプレートを確立
```
