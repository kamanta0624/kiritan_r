# 内政パート 設計ドキュメント

> 作成: 2026-05-22
> ステータス: 設計確定・実装前

---

## 1. 概要

マップ画面（1ターン）で行える内政アクションの設計。
侵攻・内政すべてを「行動力」で統一管理する。

---

## 2. 行動力（Action Points）

### 仕様

| 項目 | 内容 |
|------|------|
| 初期値 | 5/ターン |
| 最大値 | `maxActionPoints`（イベント・アイテムで永続増加） |
| 表示 | TopBarに「⚡現在/最大」形式で表示 |
| 回復 | ターンエンド時に `maxActionPoints` まで全回復 |
| 強制終了 | なし。0になっても手動でターンエンドするまで行動可能 |

### 行動力消費一覧

| アクション | 消費 |
|-----------|------|
| 侵攻（拠点攻撃） | 1 |
| キャラクター強化 | 1 |
| 劇場イベント実行 | 1 |
| ダンジョン探索 | 1 |
| 研究投入 | 0（ミームのみ消費） |

### GameContext 追加フィールド

```js
actionPoints:    5,   // 現在の行動力（ターンエンドで全回復）
maxActionPoints: 5,   // 最大行動力（永続。イベント・アイテムで増加）
```

### 増加方法

EventEngine の effect タイプに以下を追加：

```js
{ type: 'actionPointsBonus', delta: 1 }
// maxActionPoints を永続 +1 する
```

アイテム効果からも同様に適用可能。

---

## 3. 研究ツリー

### 仕様

- ツリー形式。前提研究 or イベントフラグを満たすと次の研究がアンロック
- ミーム投入で研究開始 → 一定ターン後に完了（直列・同時進行なし）
- 研究完了の効果: **キャラ強化コマンドのアンロック** と **イベントフラグ** のみ
  - キャラパラメータの直接変更は行わない
- 研究コスト（ミーム）は投入時に即引き落とし
- 研究中は他の研究を開始不可（ResearchSceneでグレーアウト）
- 行動力消費なし

### GameContext 追加フィールド

```js
researchQueue: null,
// null or { id: 'research_001', turnsRemaining: 3 }
```

### ターンエンド時の処理

```
turnsRemaining を 1 減らす
→ 0 になったら研究完了
  → 完了フラグを立てる（例: eventFlags['research_001_done'] = true）
  → アンロック処理（upgradeUnlocks に研究IDを追加）
  → researchQueue を null にする
```

### research.json フィールド（追加・変更）

```json
{
  "id": "research_001",
  "name": "軍備増強",
  "description": "SP補充コマンドを解放する",
  "cost": 500,
  "turns": 3,
  "prerequisites": {
    "research": [],
    "flags": []
  },
  "unlocks": {
    "upgradeCommands": ["sp_refill"],
    "flags": ["research_001_done"]
  }
}
```

---

## 4. キャラクター強化

### 仕様

- PartyScene（キャラ一覧）から各キャラを選んで強化コマンドを実行
- 行動力1消費、ミーム消費
- 実行可能なコマンドは研究アンロック状況に依存

### 強化コマンド一覧

| コマンドID | 名称 | 効果 | ミーム | アンロック条件 |
|-----------|------|------|-------|--------------|
| `sp_refill` | SP補充 | soldiers を maxSoldiers の50%回復 | 100 | 初期解放 |
| `sp_max_up` | SP最大値増加 | maxSoldiers +200 | 200 | 初期解放 |
| （以降研究でアンロック） | | | | |

### GameContext 追加フィールド

```js
upgradeUnlocks: ['sp_refill', 'sp_max_up'],
// 解放済みコマンドIDのリスト。研究完了で追加される。
```

---

## 5. 劇場（Theater）

### 概要

- 訪問イベントを含むすべてのイベントを統合した画面
- MapSceneのBottomBarに「劇場」ボタンを追加
- 押すと発生可能なイベントリストをモーダル表示
- 選択して実行 → ADVScene へ遷移 → 完了後マップに戻る
- 行動力1消費

### 表示条件

各イベントの `conditions` をすべて満たしている場合のみリストに表示する。

### カテゴリ（表示順）

| カテゴリID | 表示名 | 概要 |
|-----------|--------|------|
| `visit` | 訪問 | 拠点訪問イベント（ownedBase条件あり） |
| `main` | メインイベント | ストーリーに関わるイベント |
| `character` | キャラクターイベント | キャラクター個別のイベント |
| `recurring` | 繰り返し | 何度でも実行できるイベント |

各カテゴリ内はevents.jsonの記載順で表示。

### events.json フォーマット（theater typeイベント）

```json
{
  "id": "theater_aoi_akane_osaka",
  "type": "theater",
  "category": "character",
  "title": "大都会の後日談",
  "description": "琴葉姉妹が大都会を振り返る",
  "conditions": {
    "chars": ["char_aoi", "char_akane"],
    "flags": ["defeated_daitokai"],
    "ownedBase": null,
    "minTurn": null
  },
  "cost": { "actionPoints": 1 },
  "script": "event_aoi_akane_osaka",
  "onComplete": [
    { "type": "setFlag", "flag": "theater_aoi_akane_osaka_done" }
  ],
  "repeatable": false
}
```

### conditions フィールド仕様

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `chars` | string[] | 指定キャラが全員プレイヤー勢力に所属している |
| `flags` | string[] | 指定フラグが全て立っている |
| `ownedBase` | string or null | 指定拠点IDをプレイヤーが所有している |
| `minTurn` | number or null | 指定ターン以降に表示 |
| `notFlags` | string[] | 指定フラグが立っていない（否定条件） |

### repeatable の挙動

- `false`: `onComplete` の setFlag が立つと以降リストから消える
- `true`: 何度でも実行可能。`onComplete` は毎回発火する

---

## 6. 秘書ウィジェット（PartnerWidget）

### 概要

マップ画面左下に常駐するキャラクター立ち絵UI。
自軍所属キャラから1人を「秘書」として設定できる。誰も設定しないことも可能。

---

### 基本仕様

| 項目 | 内容 |
|------|------|
| 表示位置 | マップ画面左下・固定（スクロールに追従しない） |
| 立ち絵 | キャラの `portrait` 画像。未設定またはnullの場合はデフォルトアイコン |
| 非表示 | 秘書未設定時はウィジェット自体を表示しない |
| クリック | 台詞バブルを表示（再クリックまたは数秒で消える） |

---

### 秘書設定

- PartyScene（キャラ一覧）の各キャラ詳細に「秘書に設定」ボタンを追加
- 現在の秘書には「秘書を解除」ボタンを表示
- 秘書IDはセーブデータに保存する

**GameContext 追加フィールド:**

```js
secretaryId: null,   // null or 'char_001' など
```

---

### 台詞システム

台詞は `src/game/data/secretary_lines.json` で管理。
クリック時、現在のトリガーに対応する台詞からランダムに1つ選んで表示。

**トリガー一覧:**

| トリガーID | 発火タイミング |
|-----------|--------------|
| `idle` | 特に何もないとき（通常クリック） |
| `turn_start` | プレイヤーターン開始時（自動表示） |
| `attack_select` | 攻撃コマンド選択時 |
| `upgrade_select` | キャラ強化コマンド選択時 |
| `research_start` | 研究投入時 |
| `theater_open` | 劇場を開いたとき |
| `turn_end` | ターンエンドボタン押下時 |
| `defense_prompt` | 防衛プロンプト表示時（自動） |

**secretary_lines.json フォーマット:**

```json
{
  "char_001": {
    "idle": [
      "次はどこを攻めますか？",
      "拠点の収入を増やすのも手ですよ。",
      "何か御用でしょうか？"
    ],
    "attack_select": [
      "行きますか。勝ちに行きましょう！",
      "相手の兵力、確認しましたか？"
    ],
    "defense_prompt": [
      "敵の侵攻です！どうしますか？",
      "迎え撃ちますか、それとも……"
    ]
  }
}
```

台詞未定義のトリガーは `idle` にフォールバックする。

---

### 防衛プロンプト（Defense Prompt）

侵攻を受けた際、EnemyTurnScene の後にマップ画面上にオーバーレイで表示する。
フルスクリーンのADVシーンには遷移せず、マップ上のモーダルとして実装する。

**表示内容:**

```
┌──────────────────────────────────┐
│ [立ち絵]  ⚔ 侵攻を受けています   │
│           ──────────────────     │
│           〇〇城                 │
│           攻撃勢力: △△勢         │
│           敵兵力: 2,400          │
│                                  │
│  「敵の侵攻です！どうしますか？」  │
│                                  │
│   [防衛する]      [放棄する]      │
└──────────────────────────────────┘
```

| 選択 | 処理 |
|------|------|
| 防衛する | FormationScene（defense mode）へ遷移 |
| 放棄する | `battleEnd({ conquered: true, ... })` を呼び次のキューへ |

複数の侵攻がある場合は1件ずつ順番に表示（既存の `remainingQueue` を流用）。

**App.jsx の変更点:**

`launchNextDefense` 内で直接 FormationScene に遷移していた部分を、
まず MapScene に戻り defensePrompt パラメータでオーバーレイ表示する形に変える。

```js
// 変更前: 直接 formation へ
navigate('formation', { mode: 'defense', ... });

// 変更後: map に戻り、PartnerWidget がオーバーレイ表示
navigate('map', { defensePrompt: { ...attackInfo } });
// MapScene 側で sceneParams.defensePrompt を検知してオーバーレイ表示
```

---

### 実装ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/shared/PartnerWidget.jsx` | 新規作成。立ち絵・台詞バブル・防衛プロンプトを含む |
| `src/scenes/MapScene.jsx` | PartnerWidget を追加。defensePrompt パラメータを処理 |
| `src/scenes/PartyScene.jsx` | 「秘書に設定／解除」ボタンを追加 |
| `src/context/GameContext.jsx` | `secretaryId` をstateに追加・セーブ対応 |
| `src/game/data/secretary_lines.json` | 新規作成。キャラ別台詞データ |
| `App.jsx` | `launchNextDefense` を defensePrompt オーバーレイ経由に変更 |

---

## 7. 実装順序

1. **GameContext 拡張**
   - `actionPoints` / `maxActionPoints` / `researchQueue` / `upgradeUnlocks` / `secretaryId` をstateに追加
   - `NEXT_TURN` reducer に行動力回復・研究キュー消化を追加
   - `actionPointsBonus` effectをEventEngineに追加
   - `secretaryId` をセーブ・ロード対象に追加

2. **TopBar 拡張**
   - 行動力表示（⚡現在/最大）を追加

3. **研究をターン制に変更**
   - ResearchSceneのUI（研究中表示・残りターン表示）
   - GameContextの研究キュー管理

4. **PartyScene にキャラ強化・秘書設定を追加**
   - upgradeUnlocks に基づいてコマンドボタンを表示
   - 「秘書に設定／解除」ボタン
   - 行動力・ミーム消費処理

5. **PartnerWidget 新規作成**
   - 立ち絵・台詞バブル表示
   - secretary_lines.json からランダム台詞取得
   - 防衛プロンプトオーバーレイ

6. **MapScene に PartnerWidget を組み込む**
   - defensePrompt パラメータ処理
   - App.jsx の launchNextDefense を変更

7. **TheaterScene 新規作成**
   - イベント一覧モーダル・conditions評価・カテゴリ別表示
   - ADVSceneへの遷移

8. **BottomBarに「劇場」ボタン追加**

---

## 8. 未決事項

- キャラ強化の追加コマンド（研究アンロック分）の全リスト
- 研究ツリーの全ノード定義
- 繰り返しイベントの具体的なユースケース
- secretary_lines.json の各キャラ台詞テキスト（ゲームデザイン側で用意）
