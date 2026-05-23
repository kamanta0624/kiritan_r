# 内政実装 Phase B — PartyScene強化・PartnerWidget・TheaterScene

> **Phase A完了・動作確認済みであること。**
> Phase A未完了のまま着手しない。

---

## 前提確認

- デザイントークンは `src/shared/tokens.js` から import。色の直書き禁止
- `KNOWLEDGE.md` のみ参照。`docs/archive/` は読まない
- 5174のみ起動。作業前後に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認

---

## Step 4: PartyScene にキャラ強化・秘書設定を追加

**ファイル:** `src/scenes/PartyScene.jsx`

### props 追加

```js
export default function PartyScene({
  onNavigate,
  characters,
  treasury = 0,           // 追加
  upgradeUnlocks = [],    // 追加
  secretaryId = null,     // 追加
  onUpgrade,              // 追加: (charId, commandId) => void
  onSetSecretary,         // 追加: (charId | null) => void
})
```

### 強化コマンド定義（PartyScene内にローカル定義）

```js
const UPGRADE_COMMANDS = {
  sp_refill: {
    label: 'SP補充',
    desc:  'SPをmaxの50%回復',
    cost:  100,
    apply: (char) => ({
      ...char,
      soldiers: Math.min(
        char.soldiers + Math.floor((char.maxSoldiers ?? 1000) * 0.5),
        char.maxSoldiers ?? 1000
      ),
    }),
  },
  sp_max_up: {
    label: 'SP最大値増加',
    desc:  'maxSoldiers +200',
    cost:  200,
    apply: (char) => ({ ...char, maxSoldiers: (char.maxSoldiers ?? 1000) + 200 }),
  },
};
```

### キャラ詳細パネルへの追加

各キャラ詳細表示エリアに以下を追加する:

**秘書ボタン:**
- `secretaryId === char.id` の場合: 「秘書を解除」ボタン → `onSetSecretary(null)`
- それ以外: 「秘書に設定」ボタン → `onSetSecretary(char.id)`

**強化コマンド:**
`upgradeUnlocks` に含まれるコマンドIDのボタンをキャラ詳細に表示。
実行条件: `treasury >= cmd.cost`（満たさない場合 disabled）
クリック時: `onUpgrade(char.id, commandId)`

### App.jsx 側

```jsx
case 'characters':
  return <PartyScene
    onNavigate={navigate}
    characters={characters}
    treasury={playerFaction?.treasury ?? 0}
    upgradeUnlocks={game.upgradeUnlocks}
    secretaryId={game.secretaryId}
    onUpgrade={(charId, commandId) => {
      const UPGRADE_COSTS = { sp_refill: 100, sp_max_up: 200 };
      const cost = UPGRADE_COSTS[commandId] ?? 0;
      const pf = playerFaction;
      if (!pf || pf.treasury < cost) return;
      // ミーム消費
      game.actions.setTreasury(pf.id, pf.treasury - cost);
      // 行動力消費
      game.actions.setActionPoints(game.actionPoints - 1);
      // キャラ更新（commandId別処理）
      const char = characters.find(c => c.id === charId);
      if (!char) return;
      if (commandId === 'sp_refill') {
        game.actions.updateChar({
          ...char,
          soldiers: Math.min(
            char.soldiers + Math.floor((char.maxSoldiers ?? 1000) * 0.5),
            char.maxSoldiers ?? 1000
          ),
        });
      } else if (commandId === 'sp_max_up') {
        game.actions.updateChar({ ...char, maxSoldiers: (char.maxSoldiers ?? 1000) + 200 });
      }
    }}
    onSetSecretary={(charId) => game.actions.setSecretary(charId)}
  />;
```

---

## Step 5 + 6: PartnerWidget 新規作成 ＋ MapScene・App.jsx 組み込み

### 5-1. secretary_lines.json 新規作成

**ファイル:** `src/game/data/secretary_lines.json`

```json
{
  "char_001": {
    "idle": ["次はどこを攻めますか？", "何か御用でしょうか？", "拠点の収入を増やすのも手ですよ。"],
    "turn_start": ["新しいターンが始まりました。"],
    "attack_select": ["行きますか！"],
    "upgrade_select": ["強化ですね。"],
    "research_start": ["研究を開始します。"],
    "theater_open": ["どのイベントにしますか？"],
    "turn_end": ["ターンを終了します。"],
    "defense_prompt": ["敵の侵攻です！どうしますか？", "迎え撃ちますか、それとも……"]
  }
}
```

キャラIDは仮。台詞テキストはゲームデザイン側が後で埋める。

### 5-2. PartnerWidget.jsx 新規作成

**ファイル:** `src/shared/PartnerWidget.jsx`

#### props

```js
export default function PartnerWidget({
  secretaryId,        // null | charId
  characters,         // characters配列
  secretaryLines,     // secretary_lines.json の内容
  defensePrompt,      // null | { defenderBase, attackerFaction, enemySoldiers }
  onDefend,           // () => void
  onAbandon,          // () => void
})
```

#### 基本表示

- `secretaryId` が null → 何も表示しない（defensePromptがあっても表示しない。秘書未設定時は防衛プロンプトのみ別途表示を検討するが、Phase BではdefensePromptがある場合に限りデフォルトアイコンで表示する）
- secretaryId が設定されている場合、`characters.find(c => c.id === secretaryId)` でキャラを取得
- キャラの `portrait` 画像を `<img src={char.portrait}>` で表示
- `portrait` が falsy の場合: 「👤」テキストアイコンで代替
- 表示位置: 画面左下固定（`position: 'fixed', bottom: 60, left: 16, zIndex: 200`）
- 立ち絵サイズ: 高さ160px程度。クリック可能

#### 台詞バブル

- `useState` でバブル表示状態を管理
- クリック時: `secretaryLines[secretaryId]?.idle ?? []` からランダム取得して表示
- 3秒後に自動消去（useEffect + setTimeout）
- 再クリックで即消去

#### 防衛プロンプトオーバーレイ

`defensePrompt` が non-null の場合、**立ち絵の右側に**モーダルを表示。
このモーダルは立ち絵と一体のUIとして実装する（position: absolute, 立ち絵containerからの相対配置）。

**表示内容:**

```
┌───────────────────────────────────┐
│ ⚔ 侵攻を受けています              │
│ <defenderBase.name>               │
│ 攻撃勢力: <attackerFaction.name>  │
│ 敵兵力: <enemySoldiers.toLocaleString()> │
│                                   │
│ 「<defense_prompt台詞>」           │
│                                   │
│ [防衛する]  [放棄する]             │
└───────────────────────────────────┘
```

台詞は `secretaryLines[secretaryId]?.defense_prompt ?? secretaryLines[secretaryId]?.idle ?? []` からランダム取得。

**放棄フロー（内部state）:**
- 「放棄する」クリック → 内部で確認state `abandonConfirm: true` に移行
- 確認表示に切り替わる:
  ```
  「本当に <defenderBase.name> を放棄しますか？」
  [はい、放棄する]  [戻る]
  ```
- 「はい」→ `onAbandon()` 呼び出し
- 「戻る」→ `abandonConfirm: false` に戻る

#### defensePromptがあるがsecretaryIdがnullの場合

秘書未設定時でも防衛プロンプトは表示する必要がある。
この場合、立ち絵なしでモーダルのみを画面左下に表示する。

### 5-3. App.jsx の変更

#### defenseAdvConfig・ADVSceneオーバーレイブロックの削除

App.jsx の以下を削除する:
- `defenseAdvConfig` useMemo（全体）
- `handleDefenseAdvChoice` useCallback（全体）
- return 末尾の `defenseFlow?.phase === 'adv' || defenseFlow?.phase === 'abandon_confirm'` の ADVScene オーバーレイブロック（全体）

#### defenseFlow.phase の候補から 'adv' / 'abandon_confirm' を削除

`startDefenseQueue` の `setDefenseFlow` 初期化で `phase: 'adv'` → `phase: 'defense_prompt'` に変更。
`advanceDefenseQueue` 内の `setDefenseFlow` も同様。
型コメントも更新:
```js
// defenseFlow: null | { queue, index, phase: 'defense_prompt'|'formation'|'battle', formation? }
```

#### defensePromptデータ構築

App.jsx に以下を追加:

```js
const currentDefenseItem = defenseFlow?.phase === 'defense_prompt'
  ? defenseFlow.queue[defenseFlow.index]
  : null;

const defensePromptData = currentDefenseItem ? {
  defenderBase:    currentDefenseItem.defenderBase,
  attackerFaction: factions.find(f => f.id === currentDefenseItem.attackerFactionId) ?? null,
  enemySoldiers:   currentDefenseItem.enemySoldiers ?? 0,
} : null;
```

`currentDefenseItem.enemySoldiers` の値は attackerCharIds のsoldiers合計で計算する:
```js
const attackerChars = (currentDefenseItem.attackerCharIds ?? [])
  .map(id => characters.find(c => c.id === id))
  .filter(Boolean);
const enemySoldiers = attackerChars.length > 0
  ? attackerChars.reduce((s, c) => s + (c.soldiers ?? 0), 0)
  : 0;
```

#### PartnerWidget を App.jsx の return 内に配置

```jsx
return (
  <div id="app-root" style={{ position:'relative', width:'100vw', height:'100vh' }}>
    {renderScene()}
    <PartnerWidget
      secretaryId={game.secretaryId}
      characters={characters}
      secretaryLines={secretaryLinesData}
      defensePrompt={defensePromptData}
      onDefend={() => {
        const df = defenseFlowRef.current;
        if (df) setDefenseFlow({ ...df, phase: 'formation' });
      }}
      onAbandon={() => {
        const df = defenseFlowRef.current;
        if (!df) return;
        const item = df.queue[df.index];
        game.actions.battleEnd({
          usedCharIds: [], deadCharIds: [], deadMobIds: [], unitResults: [],
          conquered:      true,
          defenderBaseId: item.defenderBase?.id ?? item.defenderBase?.baseId,
          winnerFactionId: item.attackerFactionId,
        }).then(phase => advanceDefenseQueue(phase ?? null));
      }}
    />
  </div>
);
```

`secretaryLinesData` は App.jsx の先頭でimport:
```js
import secretaryLinesData from './game/data/secretary_lines.json';
```

**MapScene のdefensePrompt propsは不要。** PartnerWidget は App.jsx レベルで直接配置するため MapScene への props 受け渡しは行わない。

### 5-4. MapScene の変更

**変更なし。** PartnerWidget は App.jsx レベルで全シーン上に重ねて表示する。
MapScene 側に defensePrompt 関連の実装を追加しない。

---

## Step 7: TheaterScene 新規作成

**ファイル:** `src/scenes/TheaterScene.jsx`（新規）

### events.json にサンプル追加

**ファイル:** `src/game/data/events.json` の末尾（または適切な位置）に以下を追加:

```json
{
  "id": "theater_sample_001",
  "type": "theater",
  "category": "recurring",
  "title": "テストイベント",
  "description": "動作確認用の繰り返しイベント",
  "conditions": { "chars": [], "flags": [], "notFlags": [], "ownedBase": null, "minTurn": null },
  "cost": { "actionPoints": 1 },
  "script": "event_sample_001",
  "onComplete": [],
  "repeatable": true
}
```

`event_sample_001` に対応するスクリプトJSONが存在しない場合は、空のscenario（`[{ type: 'end' }]`）でADVSceneを起動してすぐ戻る実装でよい。

### TheaterScene 実装

#### props

```js
export default function TheaterScene({
  onNavigate,
  events,           // events.jsonの全イベント配列（type:'theater'のみ使う）
  factions,
  bases,
  characters,
  eventFlags,
  currentTurn,
  playerFaction,
  playerBases,
  actionPoints,
  onStartTheater,   // (eventId) => void: 行動力消費・ADV起動
})
```

#### conditions 評価

```js
function evaluateConditions(ev, { characters, eventFlags, bases, currentTurn, playerFaction, playerBases }) {
  const c = ev.conditions ?? {};
  if (c.chars?.length) {
    const ok = c.chars.every(cid =>
      characters.some(ch => ch.id === cid && ch.factionId === playerFaction?.id)
    );
    if (!ok) return false;
  }
  if (c.flags?.length && !c.flags.every(f => eventFlags[f])) return false;
  if (c.notFlags?.length && c.notFlags.some(f => eventFlags[f]))  return false;
  if (c.ownedBase && !playerBases.some(b => b.id === c.ownedBase)) return false;
  if (c.minTurn != null && currentTurn < c.minTurn) return false;
  return true;
}
```

#### repeatable フィルタリング

```js
const theaterEvents = events.filter(ev => ev.type === 'theater');
const visible = theaterEvents.filter(ev => {
  if (!ev.repeatable && ev.onComplete?.some(e => e.type === 'setFlag' && eventFlags[e.flag])) {
    return false;
  }
  return evaluateConditions(ev, { characters, eventFlags, bases, currentTurn, playerFaction, playerBases });
});
```

#### カテゴリ順ソート

```js
const CATEGORY_ORDER = ['visit', 'main', 'character', 'recurring'];
const sorted = [...visible].sort((a, b) =>
  CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
);
```

#### UI

TopBar に breadcrumb `['マップ', '劇場']`。
カテゴリ別グループ表示（カテゴリラベル → イベントカード一覧）。
各カード: タイトル・description・「実行」ボタン。
`actionPoints < 1` の場合ボタンを disabled（行動力0でも一応実行させないよう制限）。
クリック時: `onStartTheater(ev.id)` 呼び出し。

#### App.jsx 側

```jsx
case 'theater':
  return <TheaterScene
    onNavigate={navigate}
    events={eventsData}
    factions={factions}
    bases={bases}
    characters={characters}
    eventFlags={game.eventFlags}
    currentTurn={currentTurn}
    playerFaction={playerFaction}
    playerBases={playerBases}
    actionPoints={game.actionPoints}
    onStartTheater={(eventId) => {
      const ev = eventsData.find(e => e.id === eventId);
      if (!ev) return;
      // 行動力消費
      game.actions.setActionPoints(game.actionPoints - 1);
      // スクリプト取得・ADV起動
      // ev.script に対応するJSONをimportする方法が確立していない場合は
      // 暫定でシンプルなシナリオをインラインで渡す
      const scenario = [
        { type: 'narration', text: `【${ev.title}】` },
        { type: 'narration', text: ev.description },
        { type: 'end' },
      ];
      navigate('adv', {
        scenario,
        cast: [],
        bg: null,
        location: ev.title,
        returnTo: 'theater',
        _onComplete: () => {
          // onCompleteエフェクト処理
          (ev.onComplete ?? []).forEach(eff => {
            if (eff.type === 'setFlag') game.actions.setFlag(eff.flag, true);
          });
        },
      });
    }}
  />;
```

`eventsData` は App.jsx 先頭でimport:
```js
import eventsData from './game/data/events.json';
```

**eventsDataのimport時、既存の events.json に theater type が存在しない場合はStep 7の先頭で追加してからimportする。**

---

## Step 8: BottomBar に「劇場」ボタン追加

**ファイル:** `src/shared/SharedUI.jsx`（BottomBar）

`isMap` ブロックのボタン群（研究・アイテム・仲間）に「劇場」を追加:

```jsx
<NavButton label="劇場" onClick={() => onNavigate('theater')} activeColor={PK} activeBg='rgba(196,66,122,.08)'/>
```

位置は「仲間」の右隣、`<div style={{flex:1}}/>` の左側。

App.jsx のシーンルーターに `theater` → `TheaterScene` を追加（Step 7で対応済み）。

---

## 完了条件（Phase B）

- [ ] QA環境（`?qa=battlefull`）で既存戦闘機能が壊れていない
- [ ] 防衛フロー: EnemyTurnScene後にPartnerWidgetの防衛プロンプトモーダルが表示される
- [ ] 防衛プロンプトで「防衛する」→ FormationScene に遷移する
- [ ] 防衛プロンプトで「放棄する」→ 確認ダイアログ → 「はい」で放棄・次キューへ進む
- [ ] 秘書設定済みの場合、防衛プロンプトに立ち絵が表示される
- [ ] MapScene左下にPartnerWidgetが表示される（秘書設定時）
- [ ] 立ち絵クリックでidle台詞バブルが表示・3秒で消える
- [ ] PartySceneでSP補充・SP最大値増加が実行できる（行動力・ミーム消費）
- [ ] PartySceneで秘書設定・解除ができる
- [ ] BottomBarに「劇場」ボタンがある
- [ ] TheaterSceneが開きサンプルイベントが表示・実行できる
- [ ] ADVSceneに遷移して劇場に戻ってこれる

---

## 完了後

このファイルを `docs/archive/` に移動する。
元の `PROMPT_domestic_impl.md` も `docs/archive/` に移動する。
`KNOWLEDGE.md` の以下を更新する:
- §6 シーン実装状況テーブル: theater を追加（GameContext✅・実データ✅）
- §18 残タスク: 内政パート実装完了として消込む
