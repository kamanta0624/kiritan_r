# 内政実装 Phase B — PartyScene強化・PartnerWidget・TheaterScene

> **Phase A 完了確認後に着手すること**
> Phase A の完了条件が全て ✅ になっていることを確認してから開始する

> 完了後: このファイルを `docs/archive/` に移動し、KNOWLEDGE.md §6 と §18 を更新すること

---

## 前提確認

- デザイントークンは `src/shared/tokens.js` から import。色の直書き禁止
- `KNOWLEDGE.md` のみ参照
- 5174のみ起動。作業前後に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認
- Phase A で追加済みのこと: `actionPoints` / `maxActionPoints` / `researchQueue` / `upgradeUnlocks` / `secretaryId` / `setSecretary` / `consumeActionPoint` / `upgradeChar`

---

## Step 4: PartyScene にキャラ強化・秘書設定を追加

**ファイル:** `src/scenes/PartyScene.jsx`

### props 追加

```js
// useGame() から取得して渡す（App.jsx 側も修正）
treasury,          // playerFaction.treasury
upgradeUnlocks,    // string[]
secretaryId,       // null | charId
actionPoints,      // number
onUpgradeChar,     // (char, commandId) => void
onSetSecretary,    // (charId) => void
onUnsetSecretary,  // () => void
```

App.jsx 側:

```jsx
case 'characters':
  return <PartyScene
    onNavigate={navigate}
    characters={characters}
    treasury={playerFaction?.treasury ?? 0}
    upgradeUnlocks={game.upgradeUnlocks}
    secretaryId={game.secretaryId}
    actionPoints={game.actionPoints}
    onUpgradeChar={(char, cmdId) => game.actions.upgradeChar(char, cmdId)}
    onSetSecretary={(charId) => game.actions.setSecretary(charId)}
    onUnsetSecretary={() => game.actions.setSecretary(null)}
  />;
```

### 強化コマンド定義

PartyScene.jsx 内に定数として定義:

```js
const UPGRADE_COMMANDS = {
  sp_refill: {
    label:   'SP補充',
    desc:    'ミーム（兵士）を最大値の50%回復',
    cost:    100,
    execute: (char) => ({
      ...char,
      soldiers: Math.min(
        (char.soldiers ?? 0) + Math.floor((char.maxSoldiers ?? 1000) * 0.5),
        char.maxSoldiers ?? 1000
      ),
    }),
  },
  sp_max_up: {
    label:   'SP最大値増加',
    desc:    'ミーム（兵士）の上限 +200',
    cost:    200,
    execute: (char) => ({
      ...char,
      maxSoldiers: (char.maxSoldiers ?? 1000) + 200,
    }),
  },
};
```

`onUpgradeChar(char, cmdId)` は GameContext 側で以下を実行:
1. `treasury -= cmd.cost`（SET_TREASURY dispatch）
2. `cmd.execute(char)` の結果を `updateChar()` で反映
3. `CONSUME_AP` dispatch

### キャラ詳細パネルへの追加

既存のキャラ詳細表示エリア（LeftPanel 相当）の下部に追加:

**秘書ボタン:**

```jsx
{secretaryId === char.id
  ? <button onClick={() => onUnsetSecretary()}>秘書を解除</button>
  : <button onClick={() => onSetSecretary(char.id)}>秘書に設定</button>
}
```

**強化コマンドボタン群:**

```jsx
{upgradeUnlocks.map(cmdId => {
  const cmd = UPGRADE_COMMANDS[cmdId];
  if (!cmd) return null;
  const canAfford = treasury >= cmd.cost;
  return (
    <button
      key={cmdId}
      disabled={!canAfford}
      onClick={() => onUpgradeChar(char, cmdId)}
    >
      {cmd.label}（{cmd.cost}ミーム）
    </button>
  );
})}
```

ミーム不足時は `disabled` 。行動力0でも実行可能（DESIGN_DOMESTIC.md §4 の仕様通り）。

---

## Step 5: PartnerWidget 新規作成

**ファイル:** `src/shared/PartnerWidget.jsx`（新規）

### インターフェース

```jsx
export default function PartnerWidget({
  secretaryId,       // null | charId
  characters,        // 全キャラ配列
  defensePrompt,     // null | { defenderBase, attackerFaction, estimatedSoldiers }
  onDefend,          // () => void
  onAbandon,         // () => void
})
```

### 基本表示（defensePrompt === null）

- `secretaryId` が null → 何も表示しない
- `secretaryId` が設定 → キャラの `portrait` 画像を左下に固定表示
  - `portrait` が null/未設定の場合は代替アイコン（文字やシンプルな SVG）
  - クリックで `idle` 台詞バブルを表示（3秒 or 再クリックで消える）

### 台詞システム

台詞データは `src/game/data/secretary_lines.json`（Step 5-1 で新規作成）から取得。

```js
import secretaryLines from '../game/data/secretary_lines.json';

function getSpeech(charId, trigger) {
  const lines = secretaryLines[charId];
  if (!lines) return null;
  const pool = lines[trigger] ?? lines['idle'] ?? [];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 防衛プロンプト表示（defensePrompt !== null）

`defensePrompt` が non-null のとき、フルスクリーンオーバーレイ（`zIndex: 200`）でモーダルを表示。
ADVScene には遷移しない。

**表示レイアウト:**

```
[立ち絵（左）]  ⚔ 侵攻を受けています
                ──────────────────
                {defenderBase.name}
                攻撃勢力: {attackerFaction.name}
                敵兵力: {estimatedSoldiers.toLocaleString()}

「{secretary_lines[charId].defense_prompt からランダム}」
（秘書未設定の場合は台詞バブルなし）

[防衛する]      [放棄する]
```

**「放棄する」フロー:** 「放棄する」クリック時はインライン確認ダイアログに切り替える（PartnerWidget 内部 state で管理）。

```
本当に「{defenderBase.name}」を放棄しますか？
[はい、放棄する]  [いいえ、戻る]
```

- 「はい」→ `onAbandon()` を呼ぶ
- 「いいえ」→ 元の防衛プロンプト表示に戻す

**`defensePrompt` の型:**

```js
{
  defenderBase:    { id, name, ... },   // bases.json のオブジェクト
  attackerFaction: { id, name, ... },   // factions.json のオブジェクト
  estimatedSoldiers: number,            // 敵推定兵力（表示用）
}
```

### Step 5-1: secretary_lines.json 新規作成

**ファイル:** `src/game/data/secretary_lines.json`

```json
{
  "_comment": "キャラID → トリガー → 台詞配列。台詞テキストは仮。ゲームデザイン側で後から更新する",
  "char_kiritan": {
    "idle": ["次はどこを攻めますか？", "何か御用でしょうか？", "拠点の収入を増やすのも手ですよ。"],
    "turn_start": ["新しいターンです。"],
    "attack_select": ["行きますか！"],
    "upgrade_select": ["強化ですね。"],
    "research_start": ["研究を開始します。"],
    "theater_open": ["どのイベントにしますか？"],
    "turn_end": ["ターンを終了します。"],
    "defense_prompt": ["敵の侵攻です！どうしますか？"]
  }
}
```

**実際のキャラIDは `characters.json` の `id` フィールドを確認して合わせること。**
`char_kiritan` はプレースホルダー。実在するIDに変更する（1件あれば動作確認は可能）。

---

## Step 6: MapScene に PartnerWidget を組み込む・防衛フロー変更

### 6-1. App.jsx の防衛フロー変更

**現行の ADVScene オーバーレイブロック（App.jsx の return 末尾）を削除する:**

```jsx
// 削除するブロック
{(defenseFlow?.phase === 'adv' || defenseFlow?.phase === 'abandon_confirm') && scene === 'map' && (
  <div style={{ position:'absolute', inset:0, zIndex:100 }}>
    <ADVScene ... />
  </div>
)}
```

**`startDefenseQueue` の navigate を変更:**

```js
// 変更前
navigate('map', { focusBaseId: item?.defenderBase?.id });
setDefenseFlow({ queue, index: 0, phase: 'adv' });

// 変更後（同じ。phase:'adv' は維持するが、描画は PartnerWidget に委譲）
navigate('map', { focusBaseId: item?.defenderBase?.id });
setDefenseFlow({ queue, index: 0, phase: 'adv' });
```

**`advanceDefenseQueue` の navigate も同様に変更:**

```js
navigate('map', { focusBaseId: nextItem?.defenderBase?.id });
setDefenseFlow({ queue: df.queue, index: nextIndex, phase: 'adv' });
```

**`handleDefenseAdvChoice` を PartnerWidget のコールバックに対応させる:**

```js
// 'defend' → FormationScene へ遷移（既存と同じ）
// 'confirm_abandon' → battleEnd 呼び出し（既存と同じ）
// 'back' は不要（PartnerWidget 内部 state で管理）
```

**MapScene に渡す `defensePrompt` を構築:**

```js
// defenseFlow.phase === 'adv' のとき defensePrompt を構築して MapScene に渡す
const defensePromptForMap = useMemo(() => {
  if (!defenseFlow || defenseFlow.phase !== 'adv') return null;
  const item = defenseFlow.queue[defenseFlow.index];
  if (!item) return null;
  const attackerFaction = factions.find(f => f.id === item.attackerFactionId);
  const attackerChars   = (item.attackerCharIds ?? [])
    .map(id => characters.find(c => c.id === id))
    .filter(Boolean);
  const estimatedSoldiers = attackerChars.reduce((s, c) => s + (c.soldiers ?? 0), 0);
  return {
    defenderBase:     item.defenderBase,
    attackerFaction:  attackerFaction ?? { name: '敵勢力' },
    estimatedSoldiers,
  };
}, [defenseFlow, factions, characters]);
```

### 6-2. MapScene.jsx 変更

```jsx
import PartnerWidget from '../shared/PartnerWidget.jsx';

// MapScene の props に追加
// defensePrompt, onDefend, onAbandon, secretaryId, characters

// レンダリング末尾に追加
<PartnerWidget
  secretaryId={secretaryId}
  characters={characters}
  defensePrompt={defensePrompt}
  onDefend={onDefend}
  onAbandon={onAbandon}
/>
```

### 6-3. App.jsx → MapScene への props 渡し

```jsx
case 'map':
  return <MapScene
    // 既存 props はそのまま維持
    ...
    // 追加
    secretaryId={game.secretaryId}
    characters={characters}
    defensePrompt={defensePromptForMap}
    onDefend={() => handleDefenseAdvChoice('defend')}
    onAbandon={() => handleDefenseAdvChoice('confirm_abandon')}
  />;
```

**`defenseFlow.phase === 'abandon_confirm'` は廃止。**
`handleDefenseAdvChoice` から `'abandon'` ケースと `'abandon_confirm'` を統合し、
放棄確認は PartnerWidget 内部で完結させる。
`handleDefenseAdvChoice('confirm_abandon')` を直接 `onAbandon` に渡す。

---

## Step 7: TheaterScene 新規作成

**ファイル:** `src/scenes/TheaterScene.jsx`（新規）

### 機能概要

- events ディレクトリ（`src/game/data/events/`）から `type: 'theater'` のイベントを収集して表示
- 現状 theater type イベントは存在しないため、動作確認用サンプルを追加する（下記 Step 7-1）
- conditions を評価し、満たすものだけリスト表示
- カテゴリ順: `visit` → `main` → `character` → `recurring`
- 「実行」ボタン: AP -1 → ADVScene 遷移 → 戻り後 onComplete 処理

### イベント収集方法

TheaterScene は events ディレクトリの各 JSON を直接 import するか、
`_index.json` を読んで動的に取得するか、いずれかの方法を選ぶこと。

**推奨:** `type: 'theater'` のイベントを別ファイル群として管理するより、
`_index.json` の `chapter: 'theater'` エントリとして追加し、
TheaterScene が起動時に `import()` で動的ロードする方が拡張しやすい。
ただし実装コストが高い場合は静的 import でも可。

### conditions 評価

```js
function evaluateConditions(cond, { characters, eventFlags, bases, playerFactionId, currentTurn }) {
  const { chars = [], flags = [], notFlags = [], ownedBase = null, minTurn = null } = cond ?? {};
  if (chars.some(id => !characters.find(c => c.id === id && c.factionId === playerFactionId))) return false;
  if (flags.some(f => !eventFlags[f])) return false;
  if (notFlags.some(f => eventFlags[f])) return false;
  if (ownedBase && !bases.find(b => b.id === ownedBase && b.factionId === playerFactionId)) return false;
  if (minTurn != null && currentTurn < minTurn) return false;
  return true;
}
```

### repeatable 挙動

- `false` かつ `onComplete` の setFlag が立っている → リストから除外
- `true` → 常に表示

### App.jsx 変更

```jsx
// case 追加
case 'theater':
  return <TheaterScene
    onNavigate={navigate}
    // useGame() から必要なものを渡す
  />;
```

### Step 7-1: サンプルイベント追加

**ファイル:** `src/game/data/events/theater/theater_sample_001.json`（新規、ディレクトリも新規作成）

```json
{
  "id": "theater_sample_001",
  "type": "theater",
  "category": "recurring",
  "title": "テストイベント",
  "description": "動作確認用の繰り返しイベント",
  "conditions": { "chars": [], "flags": [], "notFlags": [], "ownedBase": null, "minTurn": null },
  "cost": { "actionPoints": 1 },
  "script": [
    { "type": "narration", "text": "テスト会話です。" },
    { "type": "end" }
  ],
  "onComplete": [],
  "repeatable": true
}
```

`_index.json` に追記:

```json
{ "id": "theater_sample_001", "path": "theater/theater_sample_001.json", "chapter": "theater" }
```

---

## Step 8: BottomBar に「劇場」ボタン追加

**ファイル:** `src/shared/SharedUI.jsx`（BottomBar）

既存の `isMap` ブロック内、「仲間」ボタンの隣に追加:

```jsx
<NavButton label="劇場" onClick={() => onNavigate('theater')} activeColor={PK} activeBg='rgba(196,66,122,.08)'/>
```

---

## 完了条件（Phase B）

- [ ] QA環境（`?qa=battlefull`）で既存機能が壊れていない
- [ ] PartyScene でSP補充・SP最大値増加が実行できる（ミーム消費・キャラ反映）
- [ ] PartyScene で秘書設定・解除ができる
- [ ] MapScene 左下に秘書の立ち絵が表示される（secretaryId 設定時のみ）
- [ ] 立ち絵クリックで idle 台詞バブルが出て3秒で消える
- [ ] BottomBar に「劇場」ボタンがある
- [ ] TheaterScene が開き、サンプルイベントが表示・実行できる
- [ ] ADVScene に遷移して戻ってこれる
- [ ] 防衛フロー: PartnerWidget が防衛プロンプトモーダルを表示する
- [ ] 防衛フロー: 「防衛する」→ FormationScene 遷移
- [ ] 防衛フロー: 「放棄する」→ 確認ダイアログ → 「はい」で放棄処理
- [ ] 防衛フロー: 秘書設定時は立ち絵＋台詞バブルがモーダルに表示される
- [ ] 防衛フロー: 旧 ADVScene オーバーレイブロックが削除されている

---

## 完了後

1. このファイルを `docs/archive/` に移動
2. `KNOWLEDGE.md` §6 の PartyScene / MapScene 行に変更内容を追記
3. `KNOWLEDGE.md` §6 に TheaterScene 行を追加（✅ GameContext / ✅ 実データ）
4. `KNOWLEDGE.md` §18 残タスクの該当項目を完了マーク
5. `KNOWLEDGE.md` §10 防衛フローの記述を更新（ADVオーバーレイ → PartnerWidget）
