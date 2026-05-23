# 内政実装 Phase A — GameContext基盤・TopBar・ResearchScene

> Phase B（PartnerWidget・PartyScene強化・TheaterScene）は別プロンプト。
> Phase A完了・動作確認後にPhase Bを流すこと。

---

## 前提確認

- デザイントークンは `src/shared/tokens.js` から import。色の直書き禁止
- `KNOWLEDGE.md` のみ参照。`docs/archive/` は読まない
- 5174のみ起動。作業前後に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認

---

## Step 1: GameContext 拡張

**ファイル:** `src/context/GameContext.jsx`

### 1-1. createInitialState() に追加

```js
actionPoints:    5,
maxActionPoints: 5,
researchQueue:   null,   // null | { id: string, turnsRemaining: number }
upgradeUnlocks:  ['sp_refill', 'sp_max_up'],
secretaryId:     null,   // null | charId string
```

### 1-2. NEXT_TURN reducer に追加

既存のcharacter回復・factions更新処理の**後**に追加する:

```js
// 行動力全回復
const actionPoints = state.maxActionPoints ?? 5;

// 研究キュー消化
let researchQueue = state.researchQueue ?? null;
let upgradeUnlocks = [...(state.upgradeUnlocks ?? [])];
let eventFlags = { ...(state.eventFlags ?? {}) };

if (researchQueue !== null) {
  const remaining = researchQueue.turnsRemaining - 1;
  if (remaining <= 0) {
    // 研究完了
    const researchDef = researchData.research.find(r => r.id === researchQueue.id);
    if (researchDef?.unlocks?.upgradeCommands) {
      upgradeUnlocks = [...new Set([...upgradeUnlocks, ...researchDef.unlocks.upgradeCommands])];
    }
    if (researchDef?.unlocks?.flags) {
      researchDef.unlocks.flags.forEach(f => { eventFlags[f] = true; });
    }
    eventFlags[`${researchQueue.id}_done`] = true;
    researchQueue = null;
  } else {
    researchQueue = { ...researchQueue, turnsRemaining: remaining };
  }
}

return {
  ...state,
  currentTurn: state.currentTurn + 1,
  factions,
  characters,
  conqueredThisTurn: false,
  actionPoints,
  researchQueue,
  upgradeUnlocks,
  eventFlags,
};
```

**注意:** `researchData` は facilities.json ではなく、Step 1-5で追加する新しいフィールドを持つJSONを参照する。ただし facilities.json はそのまま使用し、`unlocks` フィールドが存在しない場合は undefined チェックで対応すること（後方互換）。

### 1-3. applyEffectToState に actionPointsBonus を追加

`default: return state;` の直前に追加:

```js
case 'actionPointsBonus': {
  return {
    ...state,
    maxActionPoints: (state.maxActionPoints ?? 5) + (eff.delta ?? 1),
  };
}
```

### 1-4. SET_RESEARCH_QUEUE アクションを追加（reducer）

```js
case 'SET_RESEARCH_QUEUE':
  return { ...state, researchQueue: action.payload };

case 'SET_ACTION_POINTS':
  return { ...state, actionPoints: Math.max(0, action.payload) };

case 'SET_SECRETARY':
  return { ...state, secretaryId: action.payload };
```

### 1-5. facilities.json にフィールド追加

**ファイル:** `src/game/data/facilities.json`

既存の5件それぞれに `turns` / `prerequisites` / `unlocks` を追加する。
`upgradeCommands` は今後の研究アンロック用。初期2コマンドは `upgradeUnlocks` のデフォルト値で解放済みのため、ここでは空リストでよい。

```json
{
  "research": [
    {
      "id": "info_gathering",
      "name": "情報収集術",
      "cost": 200,
      "turns": 2,
      "description": "収入 +30ミーム/ターン（勢力全体）",
      "effect": { "type": "income", "value": 30 },
      "prerequisites": { "research": [], "flags": [] },
      "unlocks": { "upgradeCommands": [], "flags": [] }
    },
    {
      "id": "trade_network",
      "name": "交易ネットワーク",
      "cost": 500,
      "turns": 3,
      "description": "収入 +60ミーム/ターン（勢力全体）",
      "effect": { "type": "income", "value": 60 },
      "prerequisites": { "research": ["info_gathering"], "flags": [] },
      "unlocks": { "upgradeCommands": [], "flags": [] }
    },
    {
      "id": "calling_allies",
      "name": "仲間への呼びかけ",
      "cost": 600,
      "turns": 3,
      "description": "キャラクターを仲間にできるようになる",
      "effect": { "type": "recruitment" },
      "prerequisites": { "research": [], "flags": [] },
      "unlocks": { "upgradeCommands": [], "flags": [] }
    },
    {
      "id": "meme_resonance",
      "name": "ミーム共鳴理論",
      "cost": 400,
      "turns": 2,
      "description": "全キャラのミーム上限 +200",
      "effect": { "type": "maxSoldiersBonus", "value": 200 },
      "prerequisites": { "research": [], "flags": [] },
      "unlocks": { "upgradeCommands": [], "flags": [] }
    },
    {
      "id": "vocal_analysis",
      "name": "歌唱解析",
      "cost": 450,
      "turns": 2,
      "description": "全キャラの歌パラメータ +5",
      "effect": { "type": "charSongBonus", "value": 5 },
      "prerequisites": { "research": [], "flags": [] },
      "unlocks": { "upgradeCommands": [], "flags": [] }
    }
  ]
}
```

### 1-6. セーブ・ロード対応（SAVE_VERSION → 8）

`serializeState` に追加:

```js
actionPoints:    state.actionPoints    ?? 5,
maxActionPoints: state.maxActionPoints ?? 5,
researchQueue:   state.researchQueue   ?? null,
upgradeUnlocks:  state.upgradeUnlocks  ?? ['sp_refill', 'sp_max_up'],
secretaryId:     state.secretaryId     ?? null,
```

`deserializeToState` の return に追加（旧セーブとの後方互換のため全てデフォルト値あり）:

```js
actionPoints:    data.actionPoints    ?? 5,
maxActionPoints: data.maxActionPoints ?? 5,
researchQueue:   data.researchQueue   ?? null,
upgradeUnlocks:  data.upgradeUnlocks  ?? ['sp_refill', 'sp_max_up'],
secretaryId:     data.secretaryId     ?? null,
```

`SAVE_VERSION` を 7 → 8 に更新。

### 1-7. GameProvider の actions に公開

既存の `actions` オブジェクトに以下を追加:

```js
setActionPoints: (n) => dispatch({ type: 'SET_ACTION_POINTS', payload: n }),
startResearch: (id) => {
  const def = systems.buildingSystem?.getDef(id);
  if (!def) return;
  const turns = def.turns ?? 1;
  // ミーム消費
  const pf = state.factions.find(f => f.isPlayer);
  if (!pf || pf.treasury < def.cost) return;
  dispatch({ type: 'SET_TREASURY', payload: { factionId: pf.id, amount: pf.treasury - def.cost } });
  dispatch({ type: 'SET_RESEARCH_QUEUE', payload: { id, turnsRemaining: turns } });
},
setSecretary: (charId) => dispatch({ type: 'SET_SECRETARY', payload: charId }),
```

**注意:** 既存の `doResearch(id)` アクションは Step 3 で ResearchScene から呼ばれなくなるが、削除はしない（後方互換）。

### 1-8. useGame() から公開するフィールドを追加

```js
actionPoints, maxActionPoints, researchQueue, upgradeUnlocks, secretaryId,
```

---

## Step 2: TopBar 行動力表示

**ファイル:** `src/shared/SharedUI.jsx`

TopBar コンポーネントのprops に `actionPoints` / `maxActionPoints` を追加。
`!breadcrumb` ブロックのゲームステータス表示（ターン・ミーム・収入・拠点）の**先頭**に行動力を追加:

```js
{ label: '⚡', val: actionPoints != null ? `${actionPoints}/${maxActionPoints ?? 5}` : null, c: AC2 },
```

`val` が `null` の場合はその項目を非表示にする（breadcrumbモード時はprops未渡しで null になるため自然に非表示）。

**MapScene側:** App.jsx の `<MapScene>` 経由で TopBar に `actionPoints` / `maxActionPoints` を渡す。
App.jsx の `gameState` オブジェクトに追加し、MapScene が TopBar に転送する実装でよい。
具体的な転送経路は MapScene.jsx の既存実装に合わせること。

---

## Step 3: ResearchScene ターン制UI対応

**ファイル:** `src/scenes/ResearchScene.jsx`

### props 変更

```js
export default function ResearchScene({
  onNavigate,
  buildingSystem,
  buildings = [],
  treasury = 0,
  onResearch,          // 既存（使用停止するが削除しない）
  researchQueue = null, // 追加
  onStartResearch,     // 追加: (id) => void
})
```

### UI変更

**研究中バナー:** `researchQueue` が非null の場合、リスト上部に表示:

```
🔬 研究中: <name>  残り <turnsRemaining> ターン
```

スタイルは既存の TEAL カラーを使った pill 形式でよい。

**ボタン制御:**
- `researchQueue !== null` の場合: 全研究ボタンをグレーアウト・disabled（研究中は新規開始不可）
- 選択中研究が `buildings` に含まれる場合: 「完了済み」表示（既存動作を維持）
- ミーム不足の場合: disabled（既存動作を維持）
- 研究開始ボタンクリック: `onStartResearch(sel.id)` を呼ぶ（ミーム消費は GameContext 側で行うため、ResearchScene 側では単純に呼ぶだけ）

**ターン数表示:** 選択中研究の詳細パネルに「研究期間: X ターン」を追加表示。

### App.jsx 側の渡し方変更

```jsx
case 'research':
  return <ResearchScene
    onNavigate={navigate}
    buildingSystem={systems?.buildingSystem}
    buildings={game.buildings}
    treasury={playerFaction?.treasury ?? 0}
    researchQueue={game.researchQueue}
    onResearch={(id) => game.actions.doResearch(id)}      // 既存（残す）
    onStartResearch={(id) => game.actions.startResearch(id)}  // 追加
  />;
```

---

## 完了条件（Phase A）

- [ ] QA環境（`?qa=battlefull`）で既存戦闘機能が壊れていない
- [ ] MapSceneのTopBarに「⚡5/5」が表示される
- [ ] ターン終了後に行動力が maxActionPoints まで全回復する
- [ ] ResearchSceneで研究を開始するとミームが即引き落とし・研究中バナーが出る
- [ ] 研究中は他の研究ボタンがグレーアウトされる
- [ ] ターンを経過すると残りターン数がカウントダウンされる
- [ ] 研究完了後 researchQueue が null に戻り、再び研究可能になる
- [ ] セーブ→ロードで actionPoints / researchQueue / secretaryId が保持される（バージョン8）

---

## 完了後

このファイルを `docs/archive/` に移動する。
`KNOWLEDGE.md` §18 残タスクの進捗を更新する。
Phase B プロンプト（`PROMPT_domestic_B.md`）を確認して着手する。
