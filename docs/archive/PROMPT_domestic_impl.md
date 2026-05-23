# 内政パート実装

> 設計詳細: `docs/DESIGN_DOMESTIC.md` を必ず先に読むこと
> 実装順序は §7 に従う。Step 1 から順番に完了させること

---

## 前提確認

- デザイントークンは `src/shared/tokens.js` から import。色の直書き禁止
- `KNOWLEDGE.md` のみ参照。`docs/archive/` は読まない
- 5174のみ起動。作業前後に `lsof -i :5173 -i :5174 -i :5175 | grep LISTEN` で確認

---

## Step 1: GameContext 拡張

**ファイル:** `src/context/GameContext.jsx`

追加するstateフィールド:

```js
actionPoints:    5,
maxActionPoints: 5,
researchQueue:   null,   // null | { id: string, turnsRemaining: number }
upgradeUnlocks:  ['sp_refill', 'sp_max_up'],
secretaryId:     null,   // null | charId string
```

`NEXT_TURN` reducerに追加する処理:
1. `actionPoints` を `maxActionPoints` まで全回復
2. `researchQueue` が null でない場合: `turnsRemaining--`
   - 0になったら:
     - `eventFlags['${id}_done'] = true` をセット
     - `upgradeUnlocks` に `research.unlocks.upgradeCommands` を追加
     - `researchQueue = null`

EventEngineに追加するeffectタイプ:
```js
{ type: 'actionPointsBonus', delta: 1 }
// → maxActionPoints を永続 +delta する
```

セーブ・ロード対象に `secretaryId` を追加（`kiritan_save_{slot}` に含める）。

---

## Step 2: TopBar 行動力表示

**ファイル:** `src/shared/SharedUI.jsx`（TopBar コンポーネント）

`useGame()` から `actionPoints` / `maxActionPoints` を取得し、表示を追加:

```
⚡ 3/5
```

表示位置はターン数の隣など既存レイアウトに合わせて判断。

---

## Step 3: ResearchScene ターン制UI対応

**ファイル:** `src/scenes/ResearchScene.jsx`

現在の `doResearch(id)` アクションを以下の仕様に変更:
- 研究開始時: `researchQueue = { id, turnsRemaining: research.turns }` をセット
- ミームは投入時に即引き落とし
- 研究中は他の研究ボタンをグレーアウト・無効化
- `researchQueue` が null でない場合、研究中の研究名と残りターン数を表示

`research.json` のフィールド追加（既存JSONに追記）:
```json
"turns": 3,
"prerequisites": { "research": [], "flags": [] },
"unlocks": { "upgradeCommands": ["sp_refill"], "flags": ["research_001_done"] }
```

既存の `doResearch` アクション実装を上記仕様に合わせて修正。

---

## Step 4: PartyScene にキャラ強化・秘書設定を追加

**ファイル:** `src/scenes/PartyScene.jsx`

### キャラ強化コマンド

`upgradeUnlocks` に含まれるコマンドのボタンをキャラ詳細に表示。

初期解放コマンド:

| コマンドID | 名称 | 効果 | ミームコスト |
|-----------|------|------|------------|
| `sp_refill` | SP補充 | soldiers を maxSoldiers の50%回復 | 100 |
| `sp_max_up` | SP最大値増加 | maxSoldiers +200 | 200 |

実行時:
- `actionPoints -= 1`（0でも実行可能。強制終了なし）
- ミーム（treasury）を消費
- キャラのstateを更新（`updateChar(char)`）

### 秘書設定

各キャラ詳細に:
- 現在の秘書以外: 「秘書に設定」ボタン → `secretaryId = char.id`
- 現在の秘書: 「秘書を解除」ボタン → `secretaryId = null`

---

## Step 5: PartnerWidget 新規作成

**ファイル:** `src/shared/PartnerWidget.jsx`（新規）

### 基本表示

- `secretaryId` が null の場合、何も表示しない
- `secretaryId` が設定されている場合、キャラの `portrait` 画像を左下に固定表示
- 画像がない場合はデフォルトアイコン（適宜実装）

### 台詞バブル

- クリック時に `secretary_lines.json` の `idle` トリガーからランダムに1つ取得して表示
- 再クリックまたは3秒で消える
- 台詞未定義トリガーは `idle` にフォールバック

### secretary_lines.json

**ファイル:** `src/game/data/secretary_lines.json`（新規）

```json
{
  "char_001": {
    "idle": ["次はどこを攻めますか？", "何か御用でしょうか？"],
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

各キャラの台詞テキストは未決（ゲームデザイン側が後で埋める）。上記は仮テキストで実装。

### 防衛プロンプトオーバーレイ

`defensePrompt` propsを受け取った場合、以下のモーダルをマップ上に表示:

```
[立ち絵]  ⚔ 侵攻を受けています
          ──────────────────
          〇〇城
          攻撃勢力: △△勢
          敵兵力: 2,400

「敵の侵攻です！どうしますか？」

[防衛する]      [放棄する]
```

- 「防衛する」→ `onDefend()` コールバック呼び出し
- 「放棄する」→ `onAbandon()` コールバック呼び出し

---

## Step 6: MapScene に PartnerWidget を組み込む

**ファイル:** `src/scenes/MapScene.jsx`
**ファイル:** `src/App.jsx`

### MapScene 変更

`PartnerWidget` をimportしてMapScene左下に配置。

`sceneParams.defensePrompt` が存在する場合、PartnerWidgetに渡してオーバーレイ表示。

```jsx
<PartnerWidget
  defensePrompt={sceneParams?.defensePrompt ?? null}
  onDefend={() => navigate('formation', { mode: 'defense', ...defensePrompt })}
  onAbandon={() => { battleEnd({ conquered: true, ... }); /* 次キューへ */ }}
/>
```

### App.jsx 変更

`launchNextDefense` 内の遷移を変更:

```js
// 変更前
navigate('formation', { mode: 'defense', ... });

// 変更後
navigate('map', { defensePrompt: { ...attackInfo } });
```

---

## Step 7: TheaterScene 新規作成

**ファイル:** `src/scenes/TheaterScene.jsx`（新規）

### 機能

- `events.json` から `type: 'theater'` のイベントを取得
- 各イベントの `conditions` を評価してフィルタリング
- カテゴリ順（visit → main → character → recurring）でリスト表示
- 各アイテムに「実行」ボタン。クリック時:
  1. `actionPoints -= 1`
  2. `navigate('adv', { scenario, returnTo: 'map', _onComplete: ... })`
  3. 完了後、`onComplete` エフェクト（`setFlag` 等）を処理

### conditions 評価ロジック

```js
function evaluateConditions(event, { factions, bases, eventFlags, currentTurn }) {
  const { chars, flags, notFlags, ownedBase, minTurn } = event.conditions;
  // chars: 全員がplayerFaction所属
  // flags: 全て立っている
  // notFlags: 全て立っていない
  // ownedBase: playerBasesに含まれる
  // minTurn: currentTurn >= minTurn
}
```

### repeatable 挙動

- `false`: `onComplete` の setFlag が立ったイベントはリストから除外
- `true`: 何度でも表示・実行可能

### events.json フォーマット追加

既存の `events.json` に theater typeイベントを追加（最低1件のサンプルを追加して動作確認）:

```json
{
  "id": "theater_sample_001",
  "type": "theater",
  "category": "recurring",
  "title": "テストイベント",
  "description": "動作確認用の繰り返しイベント",
  "conditions": { "chars": [], "flags": [], "ownedBase": null, "minTurn": null },
  "cost": { "actionPoints": 1 },
  "script": "event_sample_001",
  "onComplete": [],
  "repeatable": true
}
```

---

## Step 8: BottomBar に「劇場」ボタン追加

**ファイル:** `src/shared/SharedUI.jsx`（BottomBar コンポーネント）

既存の NavButton と同様のスタイルで「劇場」ボタンを追加。
クリック時: `navigate('theater')`

App.jsx のシーンルーターに `theater` → `TheaterScene` を追加。

---

## 完了条件

- [ ] QA環境（`?qa=battlefull`）で既存機能が壊れていない
- [ ] TopBarに行動力表示が出る
- [ ] PartySceneでSP補充・SP最大値増加が実行できる
- [ ] PartySceneで秘書設定・解除ができる
- [ ] MapScene左下に秘書の立ち絵が表示される
- [ ] 立ち絵クリックで台詞が出る
- [ ] BottomBarに「劇場」ボタンがある
- [ ] TheaterSceneが開き、サンプルイベントが表示・実行できる
- [ ] ADVSceneに遷移して戻ってこれる
- [ ] ターンエンド後に行動力が全回復する
- [ ] セーブ・ロードで secretaryId が保持される

---

## 完了後

このファイルを `docs/archive/` に移動する。
`KNOWLEDGE.md` の §6 シーン実装状況テーブルと §17 残タスクを更新する。
