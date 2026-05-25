# 研究システム実装 引き継ぎプロンプト

作成: 2026-05-24

---

## 概要

研究システムを現行のダミー実装から本実装に全面改修する。
バグ修正・データ再設計・ゲームUI改修・エディタ対応の4点が対象。

---

## 1. バグ修正（最優先）

### BUG: startResearch完了時にbuildingsに追加されない

`GameContext.jsx` の `NEXT_TURN` reducer内、研究キュー完了処理（`remaining <= 0`ブランチ）で
`ADD_RESEARCH` dispatchが呼ばれていない。

**現状コード（GameContext.jsx NEXT_TURN case内）:**
```js
if (remaining <= 0) {
  // upgradeUnlocks / eventFlags のみ付与
  // buildings への追加がない ← バグ
  researchQueue = null;
}
```

**修正内容:**
`remaining <= 0` 時に `buildings` に `researchQueue.id` を追加する。
characterEffectsも即時適用が必要（`maxSoldiersBonus`・`charSongBonus`）。
ただし、本タスクでこれらのeffectはfacilities.jsonから削除するので、
修正は「buildingsへの追加」のみでよい。

具体的には reducer を pure function のまま維持するため、
`researchQueue = null` のブランチで以下を追加：
```js
buildings: [...(state.buildings ?? []), researchQueue.id],
```

---

## 2. facilities.json 全面改修

`src/game/data/facilities.json` を以下の構造に置き換える。

### 2-1. researchノード一覧

```json
{
  "research": [
    { "id": "voice_1",      "name": "ボイス",        "category": "engine",  "cost": 200, "turns": 2, "description": "東北きりたんの基本ボイスライブラリ。全研究の起点。",      "prerequisites": [],              "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "voice_plus",   "name": "ボイス＋",      "category": "engine",  "cost": 300, "turns": 2, "description": "ボイスライブラリの拡張版。表現力が向上。",               "prerequisites": ["voice_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "voice_2",      "name": "ボイス２",      "category": "engine",  "cost": 400, "turns": 3, "description": "第2世代ボイスライブラリ。品質が大幅改善。",              "prerequisites": ["voice_plus"],  "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "aiv",          "name": "AIV",           "category": "engine",  "cost": 600, "turns": 3, "description": "AIボイス技術の導入。きりたんの歌声がAI合成可能に。",       "prerequisites": ["voice_2"],     "unlocks": { "upgradeCommands": ["kiritan_aiv"],    "flags": [] } },
    { "id": "aiv_2",        "name": "AIV2",          "category": "engine",  "cost": 800, "turns": 4, "description": "AIVの第2世代。精度と表現力がさらに向上。",               "prerequisites": ["aiv"],         "unlocks": { "upgradeCommands": ["kiritan_aiv_2"],  "flags": [] } },
    { "id": "vocal_1",      "name": "ボーカル１",    "category": "engine",  "cost": 300, "turns": 2, "description": "ボーカルスタイルの最初の拡張パック。",                    "prerequisites": ["voice_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "vocal_2",      "name": "ボーカル２",    "category": "engine",  "cost": 400, "turns": 2, "description": "ボーカルスタイル第2弾。",                              "prerequisites": ["vocal_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "vocal_nt",     "name": "ボーカルNT",    "category": "engine",  "cost": 600, "turns": 3, "description": "Natural Tone技術によるボーカル強化。",                  "prerequisites": ["vocal_2"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "studio_1",     "name": "スタジオ１",    "category": "engine",  "cost": 300, "turns": 2, "description": "レコーディング環境の整備。",                            "prerequisites": ["voice_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "studio_2",     "name": "スタジオ２",    "category": "engine",  "cost": 400, "turns": 2, "description": "スタジオ設備の強化。",                                  "prerequisites": ["studio_1"],    "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "studio_ai",    "name": "スタジオAI",    "category": "engine",  "cost": 700, "turns": 4, "description": "AI制御のスタジオシステム導入。",                         "prerequisites": ["studio_2"],    "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "vox_dorm",     "name": "VOX寮",         "category": "engine",  "cost": 400, "turns": 2, "description": "VOICEROIDたちの共同生活拠点。連携が深まる。",            "prerequisites": ["voice_plus"],  "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "hybrid_v",     "name": "バイブリッドV", "category": "engine",  "cost": 500, "turns": 3, "description": "従来型ボイスとAIの融合技術。",                          "prerequisites": ["voice_2"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "hybrid_v2",    "name": "バイブリッドV2","category": "engine",  "cost": 700, "turns": 3, "description": "ハイブリッド技術の第2世代。",                           "prerequisites": ["hybrid_v"],    "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "nu_tori",      "name": "νトリ",         "category": "engine",  "cost": 800, "turns": 4, "description": "次世代トリル技術。ボーカルNTの発展系。",                 "prerequisites": ["vocal_nt"],    "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "uta",          "name": "UTA",           "category": "engine",  "cost": 900, "turns": 4, "description": "スタジオAIが生み出した究極の歌唱システム。",              "prerequisites": ["studio_ai"],   "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "font",         "name": "フォント",      "category": "engine",  "cost": 200, "turns": 1, "description": "きりたん専用フォントの開発。",                           "prerequisites": ["voice_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "ink",          "name": "インク",        "category": "engine",  "cost": 300, "turns": 2, "description": "フォントを活かした印刷・デザイン展開。",                  "prerequisites": ["font"],        "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "peak",         "name": "ピーク",        "category": "engine",  "cost": 1000,"turns": 5, "description": "全技術の頂点。AIV2が切り拓く最高峰。",                  "prerequisites": ["aiv_2"],       "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "ex_voice_1",   "name": "EXボイス",      "category": "produce", "cost": 400, "turns": 2, "description": "ボイス＋を活かした追加収録。",                           "prerequisites": ["voice_plus"],  "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "ex_voice_2",   "name": "EXボイス２",    "category": "produce", "cost": 500, "turns": 3, "description": "ボイス２品質でのEX追加収録。",                           "prerequisites": ["voice_2"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "public_assets","name": "公式素材",      "category": "produce", "cost": 300, "turns": 2, "description": "公式配布素材セットの整備。",                            "prerequisites": ["voice_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "collab",       "name": "コラボ",        "category": "produce", "cost": 500, "turns": 3, "description": "他キャラ・他作品とのコラボ企画。",                       "prerequisites": ["public_assets"],"unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "md",           "name": "MD展開",        "category": "produce", "cost": 600, "turns": 3, "description": "グッズ・マーチャンダイズの展開。",                       "prerequisites": ["ex_voice_1"],  "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "terms",        "name": "利用規約",      "category": "produce", "cost": 200, "turns": 1, "description": "ガイドラインの整備で利用者が安心して使える環境に。",      "prerequisites": ["voice_1"],     "unlocks": { "upgradeCommands": [], "flags": [] } },
    { "id": "crowdfund",    "name": "クラファン",    "category": "produce", "cost": 700, "turns": 3, "description": "クラウドファンディングで大型開発資金を獲得。",             "prerequisites": ["md"],          "unlocks": { "upgradeCommands": [], "flags": [] } }
  ],
  "upgradeCommands": [
    {
      "id": "kiritan_aiv",
      "charId": "kiritan",
      "requiredResearch": "aiv",
      "label": "AIVきりたん",
      "desc": "AIボイス実装。歌パラ +5、SP上限UPコスト -20%",
      "cost": 300,
      "repeatable": true,
      "maxPurchase": 3,
      "effects": [
        { "type": "charSong", "delta": 5 },
        { "type": "spMaxUpCostMult", "delta": -0.2 }
      ]
    },
    {
      "id": "kiritan_aiv_2",
      "charId": "kiritan",
      "requiredResearch": "aiv_2",
      "label": "AIV2きりたん",
      "desc": "AIV第2世代。歌パラ +8、maxSoldiers +100",
      "cost": 500,
      "repeatable": true,
      "maxPurchase": 3,
      "effects": [
        { "type": "charSong", "delta": 8 },
        { "type": "maxSoldiers", "delta": 100 }
      ]
    }
  ]
}
```

### 2-2. 旧フィールドの削除

`facilities.json` から以下を削除：
- `effect`（`income`/`recruitment`/`maxSoldiersBonus`/`charSongBonus`）
- `prerequisites.research`・`prerequisites.flags`（フラット配列 `prerequisites: string[]` に変更）

### 2-3. BuildingSystem.js の修正

- `getIncomeBonus(buildings)` → `effect.type === 'income'` 参照箇所を削除（incomeボーナス研究廃止）
- `hasAcademy(buildings)` → `buildings.includes('calling_allies')` は廃止（IDが変わる）
- `getAllDefs()` はそのまま使用
- `research()` メソッドは `doResearch` からのみ呼ばれるが、今後はGameContext側で直接管理するため使用しなくてよい（後方互換として残す）
- `getUpgradeCommands(charId, buildings)` を追加：
  ```js
  getUpgradeCommands(charId, buildings) {
    return (this.upgradeCommands ?? []).filter(cmd =>
      cmd.charId === charId &&
      buildings.includes(cmd.requiredResearch)
    );
  }
  ```
  `this.upgradeCommands` は constructor で `researchData.upgradeCommands` を読む。

---

## 3. GameContext.jsx 修正

### 3-1. NEXT_TURN reducer のバグ修正

`remaining <= 0` ブランチに `buildings` への追加を加える：

```js
if (remaining <= 0) {
  // 既存: upgradeUnlocks / eventFlags 付与
  // 追加: buildings に研究IDを追加
  const newBuildings = [...(state.buildings ?? []), researchQueue.id];
  // ...
  researchQueue = null;
  // return時に buildings: newBuildings を含める
}
```

NEXT_TURN の return に `buildings: newBuildings` を追加（完了時のみ。未完了時は `state.buildings` をそのまま）。

### 3-2. upgradeCommand購入アクション追加

`actions` に `purchaseUpgrade(charId, cmdId)` を追加：

```js
purchaseUpgrade: (charId, cmdId) => {
  const bs = systemsRef.current.buildingSystem;
  const cmd = bs.upgradeCommands?.find(c => c.id === cmdId);
  if (!cmd) return false;
  const s = stateRef.current;
  const pf = s.factions.find(f => f.isPlayer);
  if (!pf || pf.treasury < cmd.cost) return false;
  const char = s.characters.find(c => c.id === charId);
  if (!char) return false;

  // maxPurchase チェック
  const purchased = (char.purchasedUpgrades ?? []).filter(id => id === cmdId).length;
  if (cmd.maxPurchase != null && purchased >= cmd.maxPurchase) return false;

  // treasury 消費
  dispatch({ type: 'SET_TREASURY', payload: { factionId: pf.id, amount: pf.treasury - cmd.cost } });

  // キャラにeffect適用 + purchasedUpgrades 更新
  const updatedChar = {
    ...char,
    purchasedUpgrades: [...(char.purchasedUpgrades ?? []), cmdId],
  };
  cmd.effects.forEach(eff => {
    if (eff.type === 'charSong')     updatedChar.charSong     = (updatedChar.charSong ?? 0) + eff.delta;
    if (eff.type === 'maxSoldiers')  updatedChar.maxSoldiers  = (updatedChar.maxSoldiers ?? 1000) + eff.delta;
    if (eff.type === 'spMaxUpCostMult') {
      updatedChar._spMaxUpCostMult = ((updatedChar._spMaxUpCostMult ?? 1.0) + eff.delta);
    }
  });
  dispatch({ type: 'UPDATE_CHAR', payload: updatedChar });
  return true;
},
```

### 3-3. createInitialState の修正

characters の map に `purchasedUpgrades: c.purchasedUpgrades ?? []` を追加。

### 3-4. serializeState / deserializeToState の修正

`characters` のシリアライズに `purchasedUpgrades` を追加。
デシリアライズ側も同様に補填（`purchasedUpgrades: c.purchasedUpgrades ?? []`）。

### 3-5. SAVE_VERSION

`8 → 9` に更新。旧v8セーブは `purchasedUpgrades: []` をデフォルト補填。

---

## 4. ResearchScene.jsx 全面改修

### 4-1. ツリー表示

ノードをSVGで接続線付きツリー表示に変更。
レイアウトはDAG（有向非巡回グラフ）を手動配置 or 自動計算で実現。

**ノード配置案（列ベース）:**
- col 0: voice_1, terms, public_assets, font
- col 1: voice_plus, vocal_1, studio_1, ink
- col 2: voice_2, vocal_2, studio_2, vox_dorm
- col 3: aiv, vocal_nt, studio_ai, hybrid_v, ex_voice_1, ex_voice_2, collab
- col 4: aiv_2, nu_tori, uta, hybrid_v2, md
- col 5: peak, crowdfund

エッジ（接続線）は `prerequisites` フィールドから自動生成。
SVG `<line>` または `<path>` でノード間を結ぶ。

**ノード状態:**
- 未解放（前提未達）: グレー、クリック不可
- 解放済み（前提達成・未研究）: 通常表示
- 研究中: TEAL枠 + 残りターン表示
- 研究済み: ✓バッジ、暗転

**カテゴリ色:**
- engine: TEAL
- produce: AC

### 4-2. 詳細パネル（右側）

- 研究名・説明・コスト・ターン数
- 前提研究リスト（達成/未達成を色で表示）
- `unlocks.upgradeCommands` があれば「この研究でアンロックされる強化」を表示
- 研究ボタン（前提未達・ミーム不足・研究中でdisabled）

### 4-3. Props変更なし

App.jsx側のprops渡しは変更不要（`buildingSystem`・`buildings`・`treasury`・`researchQueue`・`onStartResearch`）。

---

## 5. PartyScene.jsx 改修

### 5-1. 強化コマンドパネル追加

現状の `sp_refill` / `sp_max_up` の2ボタンに加え、
`buildingSystem.getUpgradeCommands(char.id, buildings)` で取得した
キャラ専用コマンドを表示するパネルを追加。

**パネル設計:**
- 左パネル（キャラ詳細・現行の秘書ボタン等）はそのまま
- 右パネルを「汎用コマンド」と「キャラ固有強化」の2セクションに分割
- 汎用コマンド: sp_refill / sp_max_up（現行維持）
- キャラ固有強化: アンロック済みコマンドをカード形式で表示
  - 購入済み回数 / maxPurchase を表示
  - コスト・効果説明・購入ボタン

### 5-2. Props追加

App.jsx から以下を追加で渡す：
```jsx
<PartyScene
  ...既存props...
  buildings={game.buildings}
  onPurchaseUpgrade={(charId, cmdId) => game.actions.purchaseUpgrade(charId, cmdId)}
/>
```

### 5-3. App.jsx の onUpgrade ハンドラ修正

現行の `sp_max_up` コストは固定200だが、
`char._spMaxUpCostMult` が存在する場合にコストを乗算する：
```js
const baseCost = UPGRADE_COSTS[commandId] ?? 0;
const mult = commandId === 'sp_max_up' ? (char._spMaxUpCostMult ?? 1.0) : 1.0;
const cost = Math.floor(baseCost * Math.max(0.2, mult));
```

---

## 6. エディタ対応

### 6-1. editor-ui.html

タブに「研究」を追加：
```html
<button class="tab" onclick="window.EditorApp.switchTab('research')">研究</button>
```

### 6-2. editor-modules/tab-research.js（新規作成）

機能：
- 研究ノード一覧表示（テーブル形式）
- ノード編集モーダル：id/name/category/cost/turns/description/prerequisites（マルチセレクト）/unlocks.upgradeCommands
- upgradeCommands一覧・編集（charId/requiredResearch/label/desc/cost/repeatable/maxPurchase/effects）
- 保存ボタン → `POST /api/save/facilities`

### 6-3. editor.cjs 追加エンドポイント

**GET `/api/data`** に `facilities` を追加：
```js
const facilities = readJSONSafe(path.join(DATA, 'facilities.json'), { research: [], upgradeCommands: [] });
// payload に facilities を追加
```

**POST `/api/save/facilities`** を追加：
```js
if (pathname === '/api/save/facilities') {
  const body = await readBody(req);
  writeJSON(path.join(DATA, 'facilities.json'), JSON.parse(body.toString()));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
  return;
}
```

---

## 7. 実装順序

1. **BUG修正**（GameContext NEXT_TURN reducer）
2. **facilities.json 置き換え**
3. **BuildingSystem.js 修正**（upgradeCommands読み込み・getUpgradeCommands追加）
4. **GameContext.jsx 修正**（purchaseUpgrade・serializeState・SAVE_VERSION）
5. **ResearchScene.jsx 全面改修**（ツリー表示）
6. **PartyScene.jsx 改修**（強化パネル追加）
7. **App.jsx 修正**（buildings渡し・onPurchaseUpgrade・コスト乗算）
8. **エディタ対応**（tab-research.js・editor.cjs・editor-ui.html）

---

## 8. 注意事項

- `buildings` は string[] のまま維持（研究IDが入ったら完了扱い）
- `upgradeCommands` の `effects` に `spMaxUpCostMult` を追加したが、これはキャラの `_spMaxUpCostMult` フィールドに累積する。NEXT_TURNでリセットしない（永続効果）
- `repeatable: true` かつ `maxPurchase` 未設定は無制限購入可とする
- ResearchSceneのSVGツリーは1画面に収まることを優先。ノード数が多い場合はスクロール可にする
- KNOWLEDGE.md の「残タスク」を更新すること（BUG-014としてバグを記録、研究システムの完了時に §6 シーン実装状況テーブルを更新）
