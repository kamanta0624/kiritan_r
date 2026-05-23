# PROMPT: 拠点背景画像 野戦/籠城 2フィールド実装

## 目的
拠点ごとに「野戦用背景」「籠城用背景」の2種を設定できるようにする。
攻撃側が攻める戦闘は野戦、防衛側が守る戦闘は籠城として背景を切り替える。

## 現状
- `bases.json` の各拠点に `battleBgId` 1フィールドのみ（URL文字列）
- `BattleScene.jsx` は `targetNode?.battleBgId` を背景に使用
- エディタの拠点タブ（`tab-map.js`）に背景画像セクションあり（1枚のみ対応）

---

## 実装内容

### 1. bases.json フィールド変更

`battleBgId`（単一）→ 2フィールドに置き換え:

```json
{
  "id": "base_001",
  "name": "仙台",
  ...
  "bgField":  "/assets/battle_backgrounds/bg_001.jpg",
  "bgCastle": "/assets/battle_backgrounds/bg_002.jpg"
}
```

| フィールド | 意味 | 使用タイミング |
|-----------|------|---------------|
| `bgField`  | 野戦背景  | 攻撃側が攻める戦闘（mode='attack'） |
| `bgCastle` | 籠城背景  | 防衛側が守る戦闘（mode='defense'） |

null の場合はデフォルト `assets/bg_battle.jpg` を使う。

### 2. BattleScene.jsx 修正

`BattleFlow` コンポーネントの props に `battleMode` はすでにある。
App.jsx から `mode` を追加で渡すか、既存の判定で分岐する。

現在の背景参照箇所（2か所）:

**ExchangeOverlay コンポーネント内（L760付近）:**
```js
backgroundImage: targetNode?.battleBgId
  ? `url(${targetNode.battleBgId})`
  : 'url(assets/bg_battle.jpg)',
```

**StrategyCutin コンポーネント内（L129付近）:**
```js
backgroundImage: 'url(assets/bg_battle.jpg)',
```

#### 修正方針

`BattleFlow` に `isDefense` prop を追加（boolean）。
App.jsx から渡す。BattleScene内で背景URLを決定するヘルパーを作る:

```js
function getBgUrl(targetNode, isDefense) {
  if (isDefense) {
    return targetNode?.bgCastle
      ? `url(${targetNode.bgCastle})`
      : 'url(assets/bg_battle.jpg)';
  }
  return targetNode?.bgField
    ? `url(${targetNode.bgField})`
    : 'url(assets/bg_battle.jpg)';
}
```

ExchangeOverlay と StrategyCutin の両方に `bgUrl` を props で渡して使用。

### 3. App.jsx 修正

攻撃戦闘（`case 'battle'`）:
```jsx
<BattleScene
  formation={sceneParams.formation}
  targetNode={targetBase}
  isDefense={sceneParams.mode === 'defense'}  // ← 追加
  enemyChars={enemyChars}
  ...
/>
```

防衛戦闘（`defenseFlow?.phase === 'battle'`）:
```jsx
<BattleScene
  formation={defenseFlow.formation}
  targetNode={item.defenderBase}
  isDefense={true}  // ← 追加
  enemyChars={enemyChars}
  ...
/>
```

### 4. エディタ修正（tools/editor-modules/tab-map.js）

`_appendBgSection()` を2フィールド対応に拡張。
現在の `battleBgId` 選択UIを廃止し、野戦/籠城の2セクションに分ける。

```
🎨 戦闘背景画像
  [野戦] プレビュー + セレクト + アップロード  ← bgField
  [籠城] プレビュー + セレクト + アップロード  ← bgCastle
```

`saveBase()` の保存処理:
```js
base.bgField  = document.getElementById('fb_bgField')?.value  || null;
base.bgCastle = document.getElementById('fb_bgCastle')?.value || null;
// 旧フィールド
delete base.battleBgId;
```

既存データの `battleBgId` は移行しない（nullとして扱う）。

---

## 関連ファイル
- `src/game/data/bases.json` — `battleBgId` → `bgField` / `bgCastle` に置換
- `src/scenes/BattleScene.jsx` — getBgUrl ヘルパー追加・ExchangeOverlay・StrategyCutin 修正
- `src/App.jsx` — BattleScene に `isDefense` props 追加（攻撃戦・防衛戦の2箇所）
- `tools/editor-modules/tab-map.js` — `_appendBgSection` を2フィールドUIに改修

## 注意
- `bases.json` は static import なのでエディタ保存後ゲームのページリロードが必要
- `_appendBgSection` は async で後からDOMに追加される。セレクトのIDは
  `fb_bgField` / `fb_bgCastle` で `saveBase()` から参照する
- BattleFullQAScene（QAモード）は `isDefense=false` で固定でよい

## ⚠️ tab-map.js バグ修正（最優先）

`_appendBgSection` の末尾:

```js
const btnRow = container.querySelector('.btn-row');
container.insertBefore(section, btnRow);
```

`container` = `formArea`（`div#mapFormArea`）。
`.btn-row` は `formArea` の直接の子ではなく、`buildBaseForm` が返した `wrap` の内部にある。
`insertBefore` の第2引数は呼び出し元の直接の子でなければならないため `HierarchyRequestError` が発生する。
catchで握りつぶされているためエラーも出ず、セクションが挿入されない。

**修正:**
```js
// 誤
const btnRow = container.querySelector('.btn-row');
container.insertBefore(section, btnRow);

// 正（wrap末尾に追加。保存・削除ボタンより上に背景セクションが入る）
const wrap = container.querySelector('div');
wrap.appendChild(section);
```

---

## ⚠️ パス問題（重要）

画像ファイルの保存先は `public/battle_backgrounds/`。

エディタサーバ(3001)は `/assets/battle_backgrounds/bg_001.jpg` というURLで配信する（`editor.cjs` の `/assets/` ルーティング）。
ゲーム(5174・Vite)では `public/` 配下のファイルは `/battle_backgrounds/bg_001.jpg` でアクセスする。
Viteにおける `/assets/` は `src/assets/` を指すため、エディタのURLをそのままbases.jsonに保存するとゲーム側でパスが一致しない。

### 対応方針

bases.jsonに保存する値を `/battle_backgrounds/bg_001.jpg`（Viteパス）に統一する。

エディタ側の修正:
- `/api/upload/battle-bg` のレスポンス `url` を `/battle_backgrounds/${newFilename}` に変更（現在は `/assets/battle_backgrounds/${newFilename}`）
- `/api/battle-backgrounds` のレスポンスも同様に `url: /battle_backgrounds/${f}` に変更
- エディタのプレビュー表示はエディタサーバ経由なので、imgのsrcには `/assets/` プレフィックスを付けて表示する（保存値とプレビューURLを分離）

BattleScene側の `getBgUrl` はそのまま使用可能（`url(/battle_backgrounds/bg_001.jpg)` でViteが解決する）。
