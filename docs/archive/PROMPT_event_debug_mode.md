# PROMPT_event_debug_mode — イベントデバッグモード実装 + イベント全作り直し

## 背景・目的

イベントシステムに構造的バグが発見された。デバッグモードを実装してイベントを検証しやすくした上で、全イベントJSONを作り直す。

---

## 判明しているバグ（コードベースで確認済み）

### BUG-A: イベントエフェクトがGameContext stateに反映されない（最重要）

**原因コード: `src/context/GameContext.jsx` の `startPlayerTurn`**

```js
dispatch({ type: 'NEXT_TURN', ... });
const wsAdapter = buildWsAdapter();
await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
```

`EventEngine.applyEffects`はwsAdapter（`buildWsAdapter()`が生成するオブジェクト）の`eventFlags`/`occurredEvents`/`factions`等を直接ミューテーションする。しかしこの変更はGameContext Reactのstateに反映される仕組みがない。

`buildWsAdapter()`は毎回`stateRef.current`から新規オブジェクトを生成するため、EventEngine実行後に次回`buildWsAdapter()`を呼ぶと変更は消える。

**結果:**
- `ev_turn1_status`のeffects `setFlag: ev_turn1_done` → wsAdapterにしか書かれずstateには残らない
- 次ターンで`ev_turn2_recruit_1`の条件`flag: ev_turn1_done`がstateRef.currentを見ると存在しない → 失敗

### BUG-B: `startPlayerTurn`でのターン番号ズレ

```js
dispatch({ type: 'NEXT_TURN', ... }); // currentTurn+1 をdispatch
const wsAdapter = buildWsAdapter();   // stateRef.currentはまだ旧値
await EventEngine.processTrigger(wsAdapter, 'player_turn', {});
```

Reactのdispatchは非同期でstateRefはレンダリング後に更新される。よってNEXT_TURN直後のbuildWsAdapterは`currentTurn`が1ずれた古い値になる。

**結果:** `ev_turn1_status`の条件`turn eq 1`は、ターン1→2進行時（つまりプレイヤーから見て2ターン目開始時）に`wsAdapter.currentTurn=1`で評価され通過する → 「ターン2に発生」と見える

### BUG-C: `ev_mito_conquest`が`player_turn`トリガーになっている

`ev_mito_conquest.json`の`"trigger": "player_turn"` → ターン開始時に`baseOwned: base_045`が満たされた瞬間に発火。本来は水戸制圧時（`base_conquered`トリガーまたはbattleEnd後）に発火すべき。

### BUG-D: `ev_first_attack_from_natto`が発火しない

`"trigger": "base_defense"`だが、`KNOWLEDGE.md §18`にある通り`base_defense`のprocessTrigger呼び出しが`App.jsx`のdefenseFlow開始前に存在しない。

---

## タスク1: デバッグモード実装

### 概要

- タイトルメニューに「デバッグモード」ボタン追加（開発中のみ表示。`import.meta.env.DEV`で制御）
- 選択すると`startNewGame()`を呼び、`isDebugMode=true`をどこかのstateに保持してmapへ遷移
- デバッグモード中の機能:

| 機能 | 実装箇所 | 内容 |
|------|---------|------|
| 戦闘強制勝利ボタン | BattleScene | battleEnd呼び出し（conquered=true, 攻撃側勝利） |
| 戦闘強制敗北ボタン | BattleScene | battleEnd呼び出し（conquered=false, 敵側勝利） |
| ミーム消費なし | GameContext actions.setActionPoints等 | 行動力・treasury消費をスキップ（各アクションのコスト判定をバイパス） |
| 行動力減らない | GameContext | `setActionPoints`でコスト0扱い |
| イベントフラグ一覧 | MapScene上のデバッグパネル | `game.eventFlags`と`game.occurredEvents`をリスト表示 |

### isDebugMode の保持

`GameContext`の`state`に`isDebugMode: false`フィールドを追加。
`START_NEW_GAME`後に`SET_DEBUG_MODE`dispatchでtrueにする。
`actions`に`setDebugMode(bool)`を公開する。

TitleSceneから`onNavigate('map', { debugMode: true })`でApp.jsxに渡し、App.jsx側で`game.actions.setDebugMode(true)`を呼ぶ。

### デバッグパネルUI

MapSceneの右下（またはオーバーレイ）に小さいパネルを表示。
`isDebugMode`がtrueのときのみレンダリング。

```
[DEBUG]
■ eventFlags:
  ev_turn1_done: true
  flag_recruit1_done: true
  ...（未設定は表示しない）

■ occurredEvents:
  ev_turn1_status: 1
  ...
```

デザイントークン使用。色の直書き禁止。

---

## タスク2: BUG-A/B の根本修正

`startPlayerTurn`を修正する。

### 方針

EventEngine実行後にwsAdapterの変化をGameContext stateにdispatchで反映する処理を追加する。

```js
const startPlayerTurn = useCallback(async () => {
  syncLegionAI();
  const ai = legionAIRef.current;
  const bs = systemsRef.current.buildingSystem;
  const s  = stateRef.current;
  const incomeBonus = bs.getIncomeBonus(s.buildings);
  const existingIds = new Set(s.characters.map(c => c.id));
  const mobAdditions = ai
    ? ai.characters.filter(c => c._isMobInstance && !existingIds.has(c.id))
    : [];

  // NEXT_TURNの新stateを手動計算してcurrentTurnを取得
  const nextTurn = s.currentTurn + 1;
  dispatch({ type: 'NEXT_TURN', payload: { incomeBonus, mobAdditions } });

  // wsAdapterのcurrentTurnを正しいターン番号で構築
  const wsAdapter = buildWsAdapter();
  wsAdapter.currentTurn = nextTurn; // BUG-B修正: NEXT_TURN適用後のターン番号を使う

  await EventEngine.processTrigger(wsAdapter, 'player_turn', {});

  // BUG-A修正: EventEngineが書き換えたwsAdapterのstateをGameContextに反映
  dispatch({
    type: 'SYNC_EVENT_STATE',
    payload: {
      eventFlags:     wsAdapter.eventFlags,
      occurredEvents: wsAdapter.occurredEvents,
      flagTimestamps: wsAdapter.flagTimestamps,
      factions:       wsAdapter.factions,
      characters:     wsAdapter.characters,
      bases:          wsAdapter.bases,
      inventory:      wsAdapter.inventory,
    },
  });
}, [syncLegionAI, buildWsAdapter]);
```

`gameReducer`に`SYNC_EVENT_STATE`ケースを追加:

```js
case 'SYNC_EVENT_STATE':
  return { ...state, ...action.payload };
```

同様に`runEnemyPhase`、`battleEnd`（base_conquered後）でもwsAdapter実行後に`SYNC_EVENT_STATE`をdispatchする。

---

## タスク3: BUG-C/D の修正

### BUG-C: ev_mito_conquest.json のトリガー変更

`"trigger": "player_turn"` → `"trigger": "base_conquered"` に変更。

条件の`baseOwned`を`baseConquered`に変更:

```json
"conditions": [
  {
    "type": "baseConquered",
    "baseId": "base_045"
  },
  {
    "type": "noFlag",
    "flag": "flag_mito_conquest_done"
  }
]
```

### BUG-D: base_defenseトリガーの発火

`App.jsx`の`startDefenseQueue`内、defenseFlow開始直前（`setDefenseFlow`でphase:'adv'にする前）に以下を追加:

```js
// base_defenseイベント発火
await game.actions.processEventTrigger('base_defense', {
  attackerFactionId: currentDefense.attackerFaction.id,
});
```

`game.actions`に`processEventTrigger(trigger, ctx)`を追加:

```js
const processEventTrigger = useCallback(async (trigger, ctx = {}) => {
  const wsAdapter = buildWsAdapter();
  await EventEngine.processTrigger(wsAdapter, trigger, ctx);
  dispatch({
    type: 'SYNC_EVENT_STATE',
    payload: {
      eventFlags:     wsAdapter.eventFlags,
      occurredEvents: wsAdapter.occurredEvents,
      flagTimestamps: wsAdapter.flagTimestamps,
      factions:       wsAdapter.factions,
      characters:     wsAdapter.characters,
      bases:          wsAdapter.bases,
      inventory:      wsAdapter.inventory,
    },
  });
}, [buildWsAdapter]);
```

同様に`base_visit`も将来的にBaseMenuScene.jsxの「訪問」ボタンで`processEventTrigger('base_visit', ...)`を呼ぶ必要があるが、本タスクでは対応しない。

---

## タスク4: イベントJSON全作り直し（タスク1〜3完了後）

イベント関連ファイルをすべて作り直す。

### 作り直す対象

`src/game/data/events/system/` 以下の全JSON（特にev_turn1_status, ev_turn2_recruit_1/2）と`ch01_tohoku/`以下。

### 作り直し方針

1. 既存ファイルをバックアップ（`docs/archive/events_backup/`にコピー）
2. 各イベントの意図を旧バージョン(`/Users/kamatashintarou/MCP_Learning/kiritan/`)の実装から確認
3. 新しいスキーマでJSONを再作成
4. デバッグモードを使って動作確認

### 旧バージョン参照先

```
/Users/kamatashintarou/MCP_Learning/kiritan/src/data/events/
```

ただし旧版はPhaser版なので、JSONスキーマが異なる場合は`EventEngine.js`の現行スキーマに合わせて変換すること。

---

## 作業順序

1. タスク2（BUG-A/B修正）→ GameContextのSYNC_EVENT_STATE実装
2. タスク3（BUG-C/D修正）→ ev_mito_conquest.json修正 + processEventTrigger追加
3. タスク1（デバッグモード）→ TitleScene + MapScene + BattleScene + GameContext
4. タスク4（イベントJSON作り直し）→ デバッグモードで動作確認しながら

---

## 注意事項

- デザイントークンは`src/shared/tokens.js`から import。色の直書き禁止
- `import.meta.env.DEV`でデバッグUI表示を制御（コンパイル時に消える）
- SYNC_EVENT_STATEはstateを丸ごと上書きしないこと。必要なフィールドだけspreadする
- `occurredEvents`はEventEngine._runEvent内でwsAdapter.occurredEventsを直接インクリメントしているため、NEXT_TURN後のstateと競合しないよう注意
- 5174のみ起動。確認: `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN`
