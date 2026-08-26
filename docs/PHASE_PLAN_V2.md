# PHASE_PLAN_V2.md — kiritan_r 方針2 フェーズ計画

> 状態: 設計確定中（実装未着手）
> 関連: `DESIGN_V2.md`（俯瞰） / `KNOWLEDGE.md` / `docs/DESIGN_software_dev.md`（旧layer1・P3 で吸収）
> 最終更新: 2026-06-25

ファイル単位のスコープ、変更箇所、検証基準、依存関係を記す。
各フェーズは独立した引き継ぎプロンプト（`docs/prompts/PROMPT_v2_<phase>.md`）として切り出す。

---

## P1. UI 削除（独立着手可）

### スコープ

研究 / アイテム / 仲間強化コマンド / 兵力 / 通貨 / income の UI 経路削除。
**シーン本体・データ構造・計算ロジック・セーブ互換は温存**。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/shared/SharedUI.jsx` | `BottomBar` の `<NavButton label="研究">` / `<NavButton label="アイテム">` を削除。`TopBar` の通貨表示・income 表示要素を削除（要該当箇所特定） |
| `src/scenes/MapScene.jsx` | tooltip の `['防御部隊', ..., TXD]` 行（L263 付近）削除。`troops` 生成（L415 付近）は維持か削除か要判断 |
| `src/scenes/BaseMenuScene.jsx` | `<StatTile label="兵力">`（L84 付近）削除 |
| `src/scenes/PartyScene.jsx` | 強化コマンドUI（`sp_refill` / `sp_max_up` ボタン領域）削除 |
| `src/context/GameContext.jsx` または `src/game/systems/ItemSystem.js` | `itemGain` エフェクトを no-op 化 + `@deprecated item system frozen` コメント |
| `src/scenes/DungeonScene.jsx` | `rewardItem` 付与停止 + `@deprecated` コメント |

### 残置確認

以下は **削除しない**:
- `src/scenes/ResearchScene.jsx` / `src/scenes/ItemsScene.jsx`（シーン本体）
- `src/game/data/items.json` / `src/game/systems/ItemSystem.js`（データ・システム）
- `inventory` / `equipment` / `treasury` / `income` / `researchQueue` / `upgradeUnlocks` / `purchasedUpgrades` フィールド
- セーブシリアライズ箇所

### 検証基準

1. `npm run build` 成功
2. マップ BottomBar が「メニュー / 仲間 / 劇場 / 次のターン」のみ表示（プロモ・クラファンは P2/P3 で追加）
3. マップ tooltip に「防御部隊 N 兵」表示なし
4. `BaseMenuScene` に「兵力」項目なし
5. `PartyScene` に「SP補充」「SP上限UP」ボタンなし
6. `TopBar` に通貨・収入表示なし
7. ダンジョン報酬でアイテム付与なし（インベントリ件数不変）
8. 旧セーブ（v9）ロード時にエラーなし、`SAVE_VERSION` 据置

### 依存

なし。最速で着手可能。

### 想定工数

中規模（複数ファイル横断、ロジック改変はゼロ）。Code 1セッションで完結見込み。


---

## P2. プロモーション画面（新規実装）

### スコープ

訓練コマンド（個別キャラのミーム加算）と汎用コマンドリストを持つ新規シーン。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/scenes/PromotionScene.jsx` | 新規。キャラ選択 + コマンドリスト + 確認ダイアログ |
| `src/shared/SharedUI.jsx` | `BottomBar` に「プロモーション」NavButton 追加 |
| `src/App.jsx` | `renderScene` に `case 'promotion'` 追加 |
| `src/context/GameContext.jsx` | アクション追加: `promoteTrain(charId, amount)` 等。`actionPoints` 消費含む |

### データ構造（暫定）

```js
// 汎用コマンド定義（暫定。仕様詰め後に確定）
const PROMOTION_COMMANDS = [
  { id: 'video_recording', name: '動画収録', cost: { actionPoints: 1 }, effect: { /* TBD */ }, unlock: { /* TBD */ } },
  { id: 'song',            name: '歌',       cost: { actionPoints: 1 }, effect: { /* TBD */ }, unlock: { /* TBD */ } },
  { id: 'official_assets', name: '公式素材供給', cost: { actionPoints: 1 }, effect: { /* TBD */ }, unlock: { /* TBD */ } },
  // ... 領地進行で増える
];
```

配置案: `src/game/data/promotion_commands.json` 新設。

### 検証基準

1. BottomBar「プロモーション」クリックで `PromotionScene` 遷移
2. 訓練実行で対象キャラの `soldiers` 増加、`actionPoints` 減少
3. ターン跨ぎで `actionPoints` 全回復
4. 解禁条件未達の汎用コマンドが非表示 or グレーアウト
5. 行動力ゼロ時にコマンドが実行不可

### 依存

P1 完了（BottomBar 構造確定後）。

### 想定工数

中〜大規模。新規シーン1枚 + データJSON1枚 + GameContext アクション。

---

## P3. クラファン画面（新規実装、第一段階: 未実装ソフト開発）

### スコープ

選択キャラのミームを消費し、未実装ソフトを開発。旧 `DESIGN_software_dev.md` の `software.json` / `char.engineDev` モデルを UI 配置のみ変更して取り込む。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/scenes/CrowdfundingScene.jsx` | 新規。キャラ選択 + ソフト一覧 + 開発ボタン |
| `src/shared/SharedUI.jsx` | `BottomBar` に「クラファン」NavButton 追加 |
| `src/App.jsx` | `renderScene` に `case 'crowdfunding'` 追加 |
| `src/game/data/softwares.json` | 新規。旧設計 §3.2 のスキーマを使用 |
| `src/game/data/characters.json` | 全 104 キャラに `engines` フラグ追加 |
| `src/context/GameContext.jsx` | `developEngine(charId, engineKey)` / `versionUpEngine(charId, engineKey)` 追加。`char.engineDev` 補填 |
| `src/game/systems/SaveSystem.js` | `SAVE_VERSION` 繰り上げ。旧セーブに `engineDev` 全0 補填 |
| `tools/editor-modules/tab-characters.js` | エンジン保有チェックボックス追加（旧設計 §7） |
| `KNOWLEDGE.md` | SAVE_VERSION 更新、`engineDev` フィールド明記 |

### 未確定要素（仕様詰めQ参照）

- 各エンジンの開発コスト（ミーム消費量）
- 各エンジンの開発効果（ステータスへの焼き込み内容）
- `versionCap`（VerUp 上限）
- 領地進行 / 研究ノードによる解禁ゲート

### 検証基準

1. BottomBar「クラファン」クリックで `CrowdfundingScene` 遷移
2. 保有エンジン（`char.engines[key]===1`）のみ表示
3. 開発実行で `engineDev[key]` が 0→1、対象キャラ `soldiers` 消費、効果適用
4. 旧セーブロード時に `engineDev` 全0 補填
5. エディタで保有フラグ編集 → 保存 → 反映

### 依存

P1 完了。旧 `DESIGN_software_dev.md` を一次資料として参照、完了後に `docs/archive/` へ移動。

### 想定工数

大規模。複数フェーズ分割推奨（layer 1 = データ層 + 計算ロジック / layer 2 = UI / layer 3 = エディタ）。


---

## P4. 劇場の報酬種別・発生条件スキーマ拡張

### スコープ

既存劇場機構（TheaterScene + EventEngine + `events/theater/*.json`）に、方針2 で要求される報酬種別と発生条件を追加。

### 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/game/systems/EventEngine.js` | 新規 effects 追加（プロモコマンド解禁・キャラクリ解禁・グッズ/コラボ等の特殊報酬） |
| `src/context/GameContext.jsx` | 上記 effects のリデューサ追加 |
| `src/game/data/events/theater/*.json` | 1キャラ5イベント構造で整備、発生条件記述 |
| `KNOWLEDGE.md` | trigger 接続状況・effects 一覧の更新 |

### 未確定要素（仕様詰めQ参照）

- 「1キャラ5イベント」の構造（既存スキーマで表現可か、新フィールド要否）
- 「ボイス収録 / グッズ制作 / コラボイベント」の具体効果
- 「プロモーションコマンド解禁」報酬の effect 形式（`unlockPromotionCommand(id)` 等）
- 「キャラクリ報酬」の永続化先（`KNOWLEDGE.md §17` 周回要素との接続）
- 発生条件: 既存 `conditions[]`（flag/turn/treasury 等）で十分か、新条件型追加要か

### 検証基準

1. 既存劇場イベントが従来通り動作
2. 新 effect 適用で対応する解禁フラグが立つ
3. 1キャラあたり5イベントの上限到達で対象キャラのイベントが出尽くす表示
4. 発生条件未達のイベントが候補から除外

### 依存

P2（プロモコマンド ID 体系確定）と P3（キャラクリ周回要素設計）に依存する可能性あり。仕様詰めQ で確定要。

### 想定工数

中規模（既存スキーマ拡張・JSON 整備が主）。シナリオライティングは別タスク。

---

## P5. SP→ミーム呼称変更

### スコープ

UI 文字列のみ「SP」→「ミーム」に置換。フィールド名 `soldiers` は据置。

### 対象ファイル

全シーン横断。主な対象:

| ファイル | 変更内容 |
|---------|---------|
| `src/shared/SharedUI.jsx` | `TopBar` 内の表記 |
| `src/scenes/PartyScene.jsx` | キャラ詳細・一覧の SP 列ラベル |
| `src/scenes/FormationScene.jsx` | 編成画面の SP 表示 |
| `src/scenes/BattleScene.jsx` | 戦闘画面の SP 表示 |
| `src/scenes/MapScene.jsx` | ツールチップ・モーダル表記 |
| `src/scenes/PromotionScene.jsx` | （P2 で新規。最初から「ミーム」表記でも可） |
| `src/scenes/CrowdfundingScene.jsx` | （P3 で新規。同上） |
| `src/shared/PartnerWidget.jsx` | 防衛プロンプトの「敵兵力」→「敵ミーム」等の判断 |
| `KNOWLEDGE.md §5` | 用語定義テーブル更新 |

### 検証基準

1. 「SP」表記が UI から消滅（grep 確認）
2. フィールド名 `soldiers` は据置（コード grep で `soldiers` 件数不変）
3. 通貨ミーム廃止後のため、UI の「ミーム」表記の指す対象が `soldiers` のみで一意

### 依存

P1〜P4 完了後の総仕上げ。P1 で通貨表示が消えた状態が前提（呼称衝突回避）。

### 想定工数

小〜中規模（テキスト置換中心、文脈考慮要）。

---

## P6 以降（参考・本計画外）

| 項目 | 備考 |
|------|------|
| クラファン第二段階以降（個別キャラのレベルアップ本体） | 仕様未定 |
| キャラクリ周回要素の具体実装 | `KNOWLEDGE.md §17` 未着手 |
| `new_game_plus` 実データ接続 | `KNOWLEDGE.md §16` 既存タスク |
| `gallery` / `settings` / `credits` シーン実装 | 既存タスク |

