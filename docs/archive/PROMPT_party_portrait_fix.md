# PROMPT_party_portrait_fix

## 目的
仲間メニュー（PartyScene）でキャラ立ち絵が表示されない不具合の修正。ADVと同じ規約パス解決へ統一する。

## 根本原因（コード確認済み）
立ち絵の解決方式がADVとPartySceneで異なる。

- ADV `src/scenes/ADVScene.jsx:68`
  ```js
  function getPortrait(charKey) {
    return charKey ? `/characters/portraits/${charKey}.png` : null;
  }
  ```
  charId基準の規約パス `/characters/portraits/<id>.png`。404時は `onError → setImgSrc(null)` でプレースホルダへ（`StandingChar`, `:73-78`）。

- PartyScene `src/scenes/PartyScene.jsx:564`
  ```js
  portrait: c.portrait ?? null,
  ```
  実データ `src/game/data/characters.json` に `portrait` フィールドは存在しない（全文検索0件）。よって全キャラ `portrait=null`。
  - `CharDetail` `:210` の `<img src={char.portrait} alt={char.name}>` はガード無し → `src=null` で壊れた画像表示。
  - `LeftPanel` `:96` / `NameItem` `:189` は `char.portrait ? <img> : placeholder` のためプレースホルダ。

## 規約パス実在ファイル（`public/characters/portraits/`）
char_004, char_005, char_006, char_008, char_009, char_016, char_017, char_049, char_075（9枚）。
これ以外のIDはファイル無し → プレースホルダへ倒す必要あり。

## 対象
`src/scenes/PartyScene.jsx` のみ。データ（characters.json）変更禁止。`/assets/portrait_*.png` と tokens.js CHARS は legacy、参照禁止。

## 実装指示
1. ADVと同一の解決関数をPartySceneにも用意（重複を避けるなら共通化可。ただし本修正の範囲はPartySceneに閉じてよい）。
   ```js
   const portraitPath = (id) => id ? `/characters/portraits/${id}.png` : null;
   ```
2. `allChars` 正規化（`:564` 付近）の `portrait` を規約パス解決に変更。
   ```js
   portrait: c.portrait ?? portraitPath(c.id),
   ```
   （`c.portrait` 明示指定があればそれを優先＝後方互換）
3. 404フォールバックを3箇所のimgに追加。ADVの `onError → null` パターンを踏襲し、読めない場合は既存のプレースホルダ分岐へ倒す。
   - `LeftPanel` `:96` の `<img>`：`onError` で当該charのportraitをnone扱いにし、placeholder分岐へ。
   - `NameItem` `:189` の `<img>`：同上。`?` プレースホルダへ。
   - `CharDetail` `:210` の `<img>`：**現状ガード無しが壊れた画像の直接原因**。`onError` 追加 + 読めない時の代替表示（プレースホルダ枠）を実装。
   実装方式はADVの `useState(src)+useEffect+onError` を流用してよい。各img単位でstate管理。

## 完了条件
- 仲間メニューで char_004 等（規約パス実在キャラ）の立ち絵がADVと同一表示。
- 規約パス不在キャラ（例 char_001 等）はプレースホルダ表示、壊れた画像アイコンを出さない。
- CharDetailオーバーレイでも同様。
- 色はすべて `src/shared/tokens.js` から。直書き禁止。

## 検証
`http://localhost:5173/?qa=...`（仲間メニュー到達）で：
1. char_004 詳細を開き立ち絵表示を確認。
2. 規約パス不在キャラでプレースホルダ確認、Consoleに404の壊れ表示が出ないこと。
