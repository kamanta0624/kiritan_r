# PROMPT: tab-map.js _appendBgSection 挿入バグ修正

## 対象ファイル
`tools/editor-modules/tab-map.js`

## 問題
`_appendBgSection()` 末尾の DOM 挿入が失敗している。
エディタのマップタブで拠点を選択しても「🎨 戦闘背景画像」セクションが表示されない。

## 原因

```
container (= formArea, div#mapFormArea)
  └─ wrap (buildBaseForm が返す div)
       ├─ .form-section（基本情報）
       ├─ .form-section（座標・パラメータ）
       ├─ .form-section（隣接拠点）
       └─ .btn-row  ← ここに削除・保存ボタン
```

現在のコード:
```js
const btnRow = container.querySelector('.btn-row');
container.insertBefore(section, btnRow);
```

`container.querySelector('.btn-row')` は `wrap` 内の `.btn-row` を返す。
`insertBefore` の第2引数は呼び出し元（`container`）の**直接の子**でなければならない。
`btnRow` は `wrap` の子であって `container` の直接子ではないため、コンソールに以下のエラーが出てセクションが挿入されない。

```
NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.
```

## 修正

`_appendBgSection` 関数末尾の2行を置き換える:

```js
// 修正前
const btnRow = container.querySelector('.btn-row');
container.insertBefore(section, btnRow);

// 修正後
const wrap = container.querySelector('div');
wrap.appendChild(section);
```

`wrap.appendChild(section)` で `.btn-row` の直後（wrap末尾）にセクションが追加される。
結果として表示順は「基本情報 → 座標・パラメータ → 隣接拠点 → **戦闘背景画像** → 削除・保存ボタン」になる。

## 確認手順
1. エディタ起動: `node tools/editor.cjs` → localhost:3001
2. マップタブ → 任意の拠点を選択
3. 右パネル最下部（削除・保存ボタンの上）に「🎨 戦闘背景画像」セクションが表示されること
4. [野戦] / [籠城] の2フィールドが存在すること
5. セレクトで画像を選択 → 保存 → bases.json の当該拠点に `bgField` / `bgCastle` が書き込まれること

## 関連
- KNOWLEDGE.md §18「戦闘背景画像システム」は完了マーク済みだが本バグにより未検証
- BattleScene.jsx / App.jsx 側の実装（getBgUrl, isDefense props）は正常に実装済み
- 本修正後にゲーム側の動作確認も実施すること
