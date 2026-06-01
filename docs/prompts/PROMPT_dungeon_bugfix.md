# ダンジョンバグ修正

作成: 2026-05-29

---

## BUG 1: 戻るボタンが白くて読めない

**ファイル:** `src/scenes/DungeonScene.jsx`

**原因:** `DungeonBtn` の `primary` なし時、テキスト色に `color` propをそのまま使う。
`color="rgba(255,255,255,.3)"` を渡すとテキストがほぼ透明になる。

**修正:** select フェーズの戻るボタン・floor_introの退却ボタンの `color` を変更する。

```js
// 変更前
<DungeonBtn label="戻る" color="rgba(255,255,255,.3)"
  onClick={() => onNavigate('map')} />

// 変更後
<DungeonBtn label="戻る" color="rgba(255,255,255,.7)"
  onClick={() => onNavigate('map')} />
```

floor_intro の退却ボタンも同様に修正：

```js
// 変更前
<DungeonBtn label="退却" color="rgba(255,255,255,.3)"
  onClick={() => onNavigate('map')} />

// 変更後
<DungeonBtn label="退却" color="rgba(255,255,255,.7)"
  onClick={() => onNavigate('map')} />
```

---

## BUG 2: 戦闘に自軍が誰もいない（OUR UNITS 0/0）

**ファイル:** `src/App.jsx`

**原因:** `BattleFlow` の `rawAllies` は `formation` を
`{ front1, front2, rear1, rear2 }` のオブジェクトとして参照する：

```js
const slots = ['front1','front2','rear1','rear2'];
const rawAllies = slots.map(k => formation?.[k]).filter(Boolean);
```

dungeon ケースで **配列** を渡しているため全スロットが `undefined` になる。

**修正:** `characters.filter` → `{ front1: characters.find }` に変更。

```js
// 変更前
formation: characters.filter(c => c.id === explorerCharId),

// 変更後
formation: { front1: characters.find(c => c.id === explorerCharId) },
```
