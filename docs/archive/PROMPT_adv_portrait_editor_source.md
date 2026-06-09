# PROMPT: ADV立ち絵をエディタ正準アセットから解決

## 責務（1つだけ）
ゲームADVの立ち絵表示を、`tokens.js` の `CHARS.portrait` ハードコード一本依存から切り離す。
characters.json のキャラID基準の正準パスを **優先**、未配置時のみ旧 `CHARS.portrait` に
フォールバック。立ち絵は1キャラ1枚・表情差分なし。

## 方針
最小差分。`getPortrait` と `charKey` 伝播のみで完結させる。新規データ層・新規ファイル・
characters.json スキーマ変更は作らない。

## 背景（コード根拠 / 推測なし）
- `src/scenes/ADVScene.jsx:573-581` `CHAR_ID_MAP` / `resolveCharId` がイベントの
  `characterId`（char_NNN）を tokens.js の c-ID へ変換。
- `getPortrait`（ADVScene.jsx:69-79）が `char.portrait` を返す。`char` は
  `CHARS`（tokens.js:33-）のオブジェクトで、`portrait` はリテラル
  `'assets/portrait_kiritan.png'` 等。
- 配信実体は `public/assets/portrait_kiritan.png`（Vite が public/ をルート配信。
  vite.config.js に base 設定なし＝確認済み）。
- characters.json のキャラに立ち絵パスフィールドは無い。ADVScene は characters.json も
  public/characters/ も読まない。ゆえにエディタ登録画像はADVに反映されない。

## 正準コントラクト（本タスクで確定。phase2 エディタ補修はこれに従う）
- ディスク保存先: `public/characters/portraits/<characterId>.png`
- ゲーム参照URL : `/characters/portraits/<characterId>.png`
- `<characterId>` = characters.json の `id` をそのまま使用（例 `char_004`）
- 1キャラ1枚・png固定

## 実装
1. **元IDの保持**: `buildScenario`（ADVScene.jsx:593付近）の各 push で、変換後 `speaker`
   （c-id）に加え、元の `characterId`（char_NNN）を `charKey` として保持。現状
   `resolveCharId(line.characterId)` で char_NNN を捨てている。対象 case:
   conversation / text / cutin / choice / dialog。
2. **cast への保持**: `buildCast`（ADVScene.jsx:645付近）の cast エントリにも `charKey`
   を持たせる（`{ id, pos, charKey }`）。
3. **getPortrait 書き換え**（ADVScene.jsx:69-79）: 引数に `charKey` を追加。expr 差分分岐を
   削除し、以下を返す。
   - `primary` = `charKey ? \`/characters/portraits/${charKey}.png\` : null`
   - `fallback` = `char?.portrait ?? null`（旧 tokens.js 立ち絵。移行用フォールバック）
4. **伝播**: `StandingChar`・`PersonaCutin` に `charKey` を渡し、`getPortrait(charKey, char)`
   で解決。`char.portrait` 直参照を撤去。
5. **onError 連鎖**: `<img onError>`（StandingChar ~141 / PersonaCutin ~365）は
   `primary` 失敗時 `fallback` へ、`fallback` も無ければ既存の未設定プレースホルダSVG分岐へ
   倒す。クラッシュさせない。

## スコープ外（やるな）
- `CHARS` 全廃・characters.json 一本化。`CHAR_ID_MAP`/`resolveCharId` は name/color/quote
  等の非画像表示用に残置。
- ID体系統合（c-id ↔ char_NNN）。
- エディタの保存先・命名・1枚化の実装（phase2 別プロンプト）。
- characters.json への portrait フィールド追加（規約パスで自己完結。データ駆動化しない）。
- expr 表情差分の再導入。
- `DEMO_SCENARIO`/`DEMO_CAST`（内部形式 dialog・charKey 無）の立ち絵。demo専用、未対応で可。
- tokens.js `CHARS.portrait` リテラル削除（当面フォールバックとして残置）。
- 画像縮小・サイズ上限（エディタ重さ対応の別件）。

## 完了状態（仕様。手順記述ではない）
- イベント駆動ADVで `/characters/portraits/<characterId>.png` が存在すれば、それが立ち絵。
- 未配置キャラは旧 tokens.js 立ち絵、それも無ければプレースホルダ。
