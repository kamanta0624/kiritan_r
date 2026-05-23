# PROMPT: アイテム初期所持フラグ実装

## 目的
エディタで登録したアイテムに「最初から所持」フラグを設け、
ゲーム開始時のinventoryに自動反映させる。

## 仕様

### items.json フィールド追加
各アイテムに `startWithPlayer: boolean` を追加。
- `true` → ゲーム開始時にinventoryへ追加
- `false`（省略時も同様） → イベント・その他でのみ入手

例:
```json
{
  "id": "item_0002",
  "name": "テスト２",
  "startWithPlayer": true,
  ...
}
```

### GameContext.jsx 修正
`createInitialState()` の `inventory: []` を以下に変更:

```js
import itemsData from '../game/data/items.json';

// createInitialState() 内
const itemSystem = new ItemSystem();
const inventory = [];
itemsData.items
  .filter(item => item.startWithPlayer === true)
  .forEach(item => itemSystem.addToInventory(inventory, item.id));

return {
  ...
  inventory,
  ...
};
```

注意: `ItemSystem` は既にGameContext内でimportされている。
`createInitialState()` はGameProvider外のトップレベル関数なので、
ItemSystemのインスタンス生成はこの関数内でのみ行う（使い捨て）。

### エディタ修正（tools/editor-modules/tab-items.js）

#### buildItemForm() に追加
`基本情報` セクションに「最初から所持」チェックボックスを追加:

```html
<div class="form-row">
  <div class="form-group">
    <label>
      <input type="checkbox" id="fi_startWithPlayer"
        ${item.startWithPlayer ? 'checked' : ''} />
      ゲーム開始時から所持
    </label>
  </div>
</div>
```

#### saveItem() に追加
```js
item.startWithPlayer = document.getElementById('fi_startWithPlayer')?.checked ?? false;
```

#### addItem() のデフォルト値に追加
```js
items.push({ ..., startWithPlayer: false });
```

## 今回の確認データ
- テスト１（item_0001）: `startWithPlayer: false`
- テスト２（item_0002）: `startWithPlayer: true`

## 関連ファイル
- `src/game/data/items.json` — フィールド追加
- `src/context/GameContext.jsx` — createInitialState()
- `tools/editor-modules/tab-items.js` — buildItemForm / saveItem / addItem

## 注意
- ItemSystem.js の `constructor` は `itemsData.items` を static import で固定している。
  JSONを書き換えた後はViteのHMRが走るが、ページフルリロードが必要。
- START_NEW_GAME dispatch時も createInitialState() が呼ばれるので自動対応済み。
- LOAD_SAVE時はセーブデータのinventoryが優先されるので影響なし。
