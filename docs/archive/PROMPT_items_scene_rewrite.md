# PROMPT: ItemsScene 全面リライト

> 作成: 2026-05-22
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

---

## 問題

ItemsScene が `DEMO_ITEMS`（ハードコード）を表示している。
実データは `items.json`（エディタで管理）と `inventory`（所持インスタンス配列）。
両者のスキーマが完全に異なり、UIも合っていない。

---

## 実データスキーマ

### items.json（マスター定義）
```json
{
  "id": "item_w002",
  "name": "騎士の槍",
  "type": "weapon",          // weapon | armor | accessory
  "slotType": "weapon",
  "description": "...",
  "effect": { "type": "charAttack", "value": 25 },
  "cost": 500,
  "sellPrice": 250
}
```

effectType一覧: `charAttack` / `charMaxHp` / `soldierAtk` / `soldierDef` / `maxSoldiers`

### inventory（GameContext state）
```js
// インスタンスの配列。同じitemIdが複数あれば個数が増える
[{ id: "inv_1", itemId: "item_w002" }, { id: "inv_2", itemId: "item_w002" }]
```

### キャラの装備スロット
```js
char.equipment = { item: itemId | null }  // 1スロットのみ
```

### ItemSystem API（`systems.itemSystem`）
```js
itemSystem.getDef(itemId)        // マスター定義取得
itemSystem.getAllDefs()          // 全マスター定義
itemSystem.effectLabel(def)      // "攻撃力 +25" 等の表示文字列
itemSystem.getEquippedDef(char)  // キャラの装備定義
```

---

## 修正方針

ItemsScene を `inventory` + `items.json` ベースで完全書き直し。
`DEMO_ITEMS` は削除。

### データ構築ロジック

```js
// inventoryをitemIdでグループ化して個数カウント
const itemSystem = systems?.itemSystem;
const defs = itemSystem?.getAllDefs() ?? [];

// inventory から { def, instances[], count } を構築
const grouped = {};
(inventory ?? []).forEach(inst => {
  if (!grouped[inst.itemId]) {
    const def = itemSystem.getDef(inst.itemId);
    if (def) grouped[inst.itemId] = { def, instances: [], count: 0 };
  }
  if (grouped[inst.itemId]) {
    grouped[inst.itemId].instances.push(inst);
    grouped[inst.itemId].count++;
  }
});
const allItems = Object.values(grouped);
// inventory空の場合: allItems = [] → "アイテムがありません" 表示
```

### 装備中判定

```js
// 装備中キャラを探す
const equippedChars = characters.filter(c => c.equipment?.item === def.id);
```

---

## UIの変更点

DEMO_ITEMSのUI（kind/rarity/消費/道具/素材/個数表示が混在）は廃止し、items.jsonスキーマに合わせる。

### フィルタータブ
```
すべて | 武器 | 防具 | 装飾品
```
（消費・道具・素材は存在しないので削除）

### アイテムカード（グリッド表示）
```
[type badge] [name]
effect: effectLabel(def)
cost: Nミーム / sell: Nミーム
count: ×N（インスタンス数）
[装備中: キャラ名] ← equippedCharsがいれば表示
```

### 詳細パネル（右側）
```
[type] [name]
EFFECT: effectLabel(def)
description
cost / sellPrice
所持数: N
装備中キャラ: [アイコン一覧]
```

### ボタン
- 「売却」ボタン → `onRemoveItem(inst.id)` で先頭インスタンスを売却
- 装備ボタンは現フェーズでは省略可（inventoryベースの装備操作はBattleScene経由）
- inventory空の場合は「アイテムがありません」のみ表示

---

## Propsの変更

現在:
```jsx
<ItemsScene onNavigate={navigate} inventory={game.inventory} onRemoveItem={game.actions.removeItem} />
```

追加で `systems` と `characters` も渡す必要がある。App.jsx側も修正。

```jsx
// App.jsx
case 'items':
  return <ItemsScene
    onNavigate={navigate}
    inventory={game.inventory}
    systems={systems}
    characters={characters}
    onRemoveItem={game.actions.removeItem}
  />;
```

---

## effectType 表示ラベル

ItemSystem.effectLabel を使う。なければ直接参照:
```js
const EFFECT_LABELS = {
  charAttack:  '攻撃力',
  charMaxHp:   '最大HP',
  soldierAtk:  '兵士攻撃力',
  soldierDef:  '兵士防御力',
  maxSoldiers: '最大兵士数',
};
```

---

## 変更ファイル

| ファイル | 変更箇所 |
|---------|---------|
| `src/scenes/ItemsScene.jsx` | 全面リライト。DEMO_ITEMS削除、実データスキーマベースのUI |
| `src/App.jsx` | ItemsScene に `systems` / `characters` を追加渡し |

---

## 確認

1. ゲーム内アイテム一覧がエディタと同じ8種（items.json準拠）を表示すること
2. inventory空の場合「アイテムがありません」表示になること
3. フィルター「武器/防具/装飾品」が正しく動作すること
4. 装備中キャラが正しく表示されること
5. DEMO_ITEMSが完全に除去されていること
