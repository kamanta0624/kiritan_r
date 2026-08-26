# PROMPT_P2_promotion_editor.md — P2-2 プロモーション エディタ統合

> 種別: Code 引き継ぎ（実装）
> 位置づけ: P2-2（エディタ統合）。P2-1 = `PROMPT_P2_promotion_devmode.md` / `_ext`（devmode・promotion_commands.json 確定）の後続
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md` §3 プロモーション仕様（§3.6 データ駆動方針）
> 前提プロンプト: `docs/prompts/PROMPT_P2_promotion_devmode.md` / `PROMPT_P2_promotion_devmode_ext.md`（promotion_commands.json 確定）
> QA: 人間が担当

### 前提メモ（実コード確認済み）
- `tools/editor.cjs` は `promotion_commands.json` を **ロードにも保存にも未対応**（`/api/data` の payload に無い・`/api/save/promotion` も無い）。本書 §1.5 の追加は**必須**。
- タブ追加は `tools/editor-ui.html`（タブボタン）＋ `main.js`（import / 分岐 / `window.EditorApp` export）の**複数箇所**が必要。
- `promotion_commands.json` は **ルートが配列 `[...]`**（親仕様 §3.8）。`items.json` の `{ items:[...] }` 形とは異なる。

---

## 0. 原則

- 既存エディタ（`tools/editor.cjs` + `tools/editor-modules/tab-*.js`）への新規タブ追加のみ
- 既存タブの実装パターン（特に `tab-items.js` / `tab-research.js`）に倣う
- データ駆動方針徹底: コマンド名・効果値・maxUses 等すべてエディタで編集可能
- 不明点は Chat に確認、独自実装パターンを作らない

---

## 1. スコープ（成功基準）

### 1.1 tab-promotion.js 新規作成

ファイル: `tools/editor-modules/tab-promotion.js`

機能:
- `src/game/data/promotion_commands.json` の読み込み・編集・保存
  - JSONルートは配列 `[...]`。`state.data.promotionCommands` も配列として扱う
- コマンド一覧表示（テーブル形式、既存タブと同様）
- 新規追加（汎用 / 限定切替）
- 編集（フィールド: id / name / limited / maxUses / effects）
- 削除
- 保存ボタン（既存タブと同じ保存メカニズム）

### 1.2 エディタへのタブ登録

以下すべてを実施する。

1. `tools/editor-ui.html`
   - タブバーに「プロモーション」ボタンを追加
   - 例: `window.EditorApp.switchTab('promotion')`
2. `tools/editor-modules/main.js` import
   - `tab-promotion.js` から `renderPromotionTab` / `savePromotion` / `addPromotionCommand` / `deletePromotionCommand` 等を import
3. `tools/editor-modules/main.js` render分岐
   - `state.tab === 'promotion'` のとき `renderPromotionTab(main)` を呼ぶ
4. `tools/editor-modules/main.js` `window.EditorApp` export
   - 保存・追加・削除など、HTML onclick から呼ぶ関数を export に追加

既存の登録パターン（`tab-items.js` / `tab-research.js` 等）に従い、独自のグローバル露出方式を作らない。

### 1.3 フィールド編集 UI

#### 共通フィールド
- `id`: 文字列入力（半角英数字 + アンダースコア推奨）
- `name`: 文字列入力（日本語可、必須）
- `limited`: チェックボックス（OFF=汎用、ON=限定）

#### 汎用時（limited=false）
- 他フィールドは非表示 or 入力不可
- `maxUses` / `effects` フィールドは存在しない（JSON 出力時にも含めない）

#### 限定時（limited=true）
- `maxUses`: 数値入力（1以上の整数、必須）
- `effects`: 配列編集 UI
  - 各エントリ: `type`（プルダウン: add / mul / set）、`key`（プルダウン）、`value`（数値）
  - `key` 候補は親仕様の効果対象キーに限定:
    `maxSoldiers` / `soldiers` / `charMaxHp` / `strategyRate` / `soldierAtk` / `soldierDef` / `charAttack` / `charDefense` / `charSong` / `attackCount` / `recoveryRate`
  - 追加ボタン / 削除ボタン / 並び替え（任意）
  - 最低1件以上必須

### 1.4 妥当性チェック

保存前 / 入力時の検証:
- `id` 重複チェック（同 JSON 内）
- `id` / `name` 空欄チェック
- 汎用時: `maxUses` / `effects` が含まれていないこと（含まれていたら警告 or 自動削除）
- 限定時:
  - `maxUses` が 1 以上の整数であること
  - `effects` が 1 件以上あり、各要素の `type` / `key` / `value` が必須
  - `type` は `'add'` / `'mul'` / `'set'` のいずれか
  - `key` は §1.3 の候補キーのいずれか
  - `value` は数値

不正値検出時は保存ブロック + UI エラー表示。

### 1.5 サーバ側対応（editor.cjs）必須

`editor.cjs` は現状 `promotion_commands.json` 未対応。以下2点を必ず追加する。

1. `/api/data` の payload に `promotionCommands` を追加
   - `readJSONSafe(path.join(DATA, 'promotion_commands.json'), [])`
   - payload キー名は **`promotionCommands`** に固定
   - `promotion_commands.json` のルートは配列。`promotionCommands` も配列として扱う
2. `/api/save/promotion` エンドポイントを追加
   - `tools/editor.cjs` の `/api/save/items` と同じパターン
   - 保存先: `src/game/data/promotion_commands.json`
   - body は配列をそのまま受け取り、JSONとして保存

`tab-promotion.js` 側も `state.data.promotionCommands`（配列）を読む。`items.json` の `{ items: [...] }` 形に変換しない。

---

## 2. 範囲外（やらない）

- promotion_commands.json のスキーマ変更（§3.7 通り、新フィールド追加禁止）
- 他タブの挙動変更
- editor.cjs の認証・セキュリティ強化等の機能追加
- エディタ UI の全体テーマ・レイアウト変更
- 限定コマンドの実効果プレビュー機能（後続）
- グローバル設定（重み・δ 等の JSON 化）→ P3-2 以降の話題

---

## 3. 着手前の事前報告

1. 参考にする既存タブ（`tab-items.js` / `tab-research.js` 等）の構造概要
2. `editor.cjs` の現状での `promotion_commands.json` 読み書き対応状況
3. `promotion_commands.json` のルート形状確認（配列 `[...]` であること）
4. 追加予定のエディタ登録箇所（`editor-ui.html` タブボタン / `main.js` import・分岐・export）
5. `effects` 配列編集 UI の具体案（既存タブで類似UIがあれば参考に）
6. `id` 重複チェックの実装位置（入力時 or 保存時）

1メッセージで報告 → Chat 確認 → 着手。

---

## 4. 完了後の報告

§1.1〜§1.5 の達成状態を1項目ずつ列挙。
編集 UI のスクリーンショット相当のテキスト記述（フィールドレイアウト）も明記。
実装完了確認として以下を報告（`npm run build` は対象外。エディタは別サーバ）:
- `npm run editor` が起動できること
- エディタ画面に「プロモーション」タブが表示されること
- 追加 / 編集 / 削除 / 保存ができること
- 保存後に `src/game/data/promotion_commands.json` へ反映されること
QA は人間が担当のため Code 側 QA はなし。
