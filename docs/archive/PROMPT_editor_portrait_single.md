# PROMPT: エディタ立ち絵登録の一本化（1枚・縮小・png・正準パス）

## 責務（1つだけ）
エディタのキャラ画像登録を「立ち絵1枚」に一本化。登録時にクライアント側 Canvas で
長辺 ≤ 1536px へ縮小・png 化し、phase1 確定の正準パス
`public/characters/portraits/<characterId>.png` へ保存する。
アイコン／シーンの複数スロットは廃止。登録画像は1キャラ1枚。

## 方針
クライアント完結。サーバ `/api/upload` 無改修（生バイト書き込みのまま、Blob を png にする）。
新規依存パッケージ禁止。最小差分。

## 依存 / 対象
- 先行: `PROMPT_adv_portrait_editor_source.md`（実装済み。正準パス `<characterId>.png` 定義元）
- 対象: `tools/editor-modules/shared.js`, `tools/editor-modules/tab-characters.js`

## 背景（コード根拠）
- `shared.js` `uploadImage(input, dest, baseName)` は原ファイルを無変換で `${baseName}.${ext}`
  として POST（リサイズ・再圧縮なし）。
- `tab-characters.js` `buildCharImages` はアイコン/立ち絵/シーンの3カード。立ち絵は
  `uploadImage(this,'characters/portraits','${c.id}_portrait')`、アイコンは
  `'characters/icons','${c.id}_icon'`。
- `tab-characters.js` `renderCharTab` の char-list サムネは
  `state.images['characters/icons']` を `i.filename.startsWith(c.id)` で参照。
- 実害確認: 226MP級の原寸 png がそのまま保存され、エディタ・ゲーム双方で約760〜900MBの
  デコードが発生しカクつく（既知）。

## 実装
1. **shared.js: 縮小・png化アップロード**
   `uploadImage`（立ち絵用）を、原ファイルを Canvas 経由で処理する形へ改修:
   - `File → Image/createImageBitmap → canvas` に描画。
   - 長辺 ≤ 1536px へアスペクト維持で縮小（元が小さければ等倍。拡大しない）。
   - `canvas.toBlob(blob => ..., 'image/png')` で png Blob 化。
   - FormData に `dest` と `new File([blob], \`${baseName}.png\`, {type:'image/png'})` を append し
     `POST /api/upload`。
   - 完了後 `reloadImages()` → `renderAll()`（既存フロー踏襲）。

2. **tab-characters.js: 立ち絵1スロット化**
   `buildCharImages` をアイコン/シーン廃し「立ち絵」1カードのみに:
   - preview: `state.images['characters/portraits']` を `i.filename === \`${c.id}.png\`` で抽出し
     `imgPreviewHTML(img,'portrait')`。
   - input `onchange` → `uploadImage(this,'characters/portraits','${c.id}')`（接尾辞なし＝保存名
     `<c.id>.png`、正準パス一致）。
   - icons / scenes カードと対応 input・ボタンを削除。
3. **tab-characters.js: char-list サムネ参照変更**
   `renderCharTab` のサムネを `state.images['characters/portraits']` から
   `i.filename === \`${c.id}.png\`` で取得する形へ。
4. **撤去前の安全確認（Code）**
   icons/scenes 撤去前に他モジュール（`tab-factions.js`/`tab-legions.js` 等）で
   `characters/icons`・`characters/scenes` 参照が無いか grep 確認。参照ありなら char タブの
   一本化のみ実施し、該当箇所は残置のうえ報告（本タスクで作り替えない）。

## スコープ外（やるな）
- phase1 ADV側（実装済み）。
- サーバ `/api/upload` 改修。
- 旧命名ファイル（`<id>_icon.*` / `<id>_portrait.*` / `<id>_scene_*`）の物理削除・移行。
- characters.json スキーマ変更（規約パス継続）。
- キャッシュバスター `?t=${Date.now()}` 除去（縮小後は実害小。別件可）。
- 他タブの icons 依存の作り替え。

## 完了状態（仕様）
- 立ち絵登録 → `public/characters/portraits/<characterId>.png` が長辺 ≤1536px・png で生成。
- エディタの char-list サムネ・preview がこの1枚を表示。
- 縮小により226MP問題が登録時点で恒久解消。
