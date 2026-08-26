# PROMPT_v2_design_continuation.md — 方針2 設計議論引き継ぎ

> 状態: 設計確定中（実装未着手）
> 目的: kiritan_r 方針2 大規模バージョンアップの設計議論を引き継ぐ
> 関連: `docs/DESIGN_V2.md` / `docs/PHASE_PLAN_V2.md` / `KNOWLEDGE.md` / `docs/DESIGN_software_dev.md`（旧layer1）
> 最終更新: 2026-06-27

注意: `DESIGN_V2.md` と `PHASE_PLAN_V2.md` は本書より古い状態（B-2 / C系統 確定前の版）。
**本書の確定事項を以後の正とする**。両ドキュメントへの反映は別タスク。

---

## 0. 文脈

鬼畜王ランス クローン路線（方針1）→ 合成音声キャラ世界観への内政刷新（方針2）への転換。
内政メニューを4つに集約（プロモーション / クラファン / 劇場 / 仲間）、それ以外オミット。
内部温存原則: UI 経路のみ削除、データ構造・計算ロジック・JSON は残す。
SP → ミーム呼称変更は最後（P5）。

---

## 1. 廃止 / 温存マトリクス

| 対象 | UI | データ/ロジック |
|------|----|------|
| 研究画面 | 削除 | 温存 |
| アイテム画面 | 削除 | 温存（`itemGain` no-op化） |
| 仲間画面の強化コマンド（`sp_refill` / `sp_max_up`） | 削除 | 温存 |
| 拠点 income | TopBar 表示削除 | 温存 |
| 通貨（treasury） | TopBar 表示削除 | 温存 |
| 兵力（troops UI） | MapScene tooltip / BaseMenuScene StatTile 削除 | 派生値、内部値（soldiers/battleCapacity）温存 |
| `characters.json` の `battleCapacity` フィールド | — | **削除**（参照箇所ゼロの死にデータ） |
| `bases.json` の `battleCapacity` | — | 維持（戦闘ロジックで使用） |
| 行動力（`actionPoints`） | 維持 | 維持 |


---

## 2. メニュー構成

マップ BottomBar:
| 項目 | 種別 | 遷移先 |
|------|------|--------|
| ≡ メニュー | 既存 | save |
| プロモーション | 新規 | promotion |
| クラファン | 新規 | crowdfunding |
| 仲間 | 既存（閲覧化） | characters |
| 劇場 | 既存 | theater |
| 次のターン | 既存 | runEnemyPhase |

削除: 研究 / アイテム の NavButton 2行。

メニュー外で存続:
- セーブ（≡ メニュー）
- 拠点クリック → BaseMenuScene
- 戦闘自動遷移（隣接攻撃 / 防衛発火）
- ダンジョン（BaseMenuScene の「ダンジョン」ボタン）

---

## 3. プロモーション仕様（確定）

### 3.1 基本

- 汎用コマンド3種（動画収録 / 歌 / 公式素材供給）、機能完全同一
- 形式: 単体選択式（対象キャラ1人を選んで実行）
- 行動力: 全コマンド共通 1消費
- 汎用3種は回数制限なし

### 3.2 汎用コマンドの効果（2択 UX）

実行時に2択モーダル:
- **補充**: 対象キャラの `soldiers` → `maxSoldiers` まで回復
  - 対象キャラが満タン（`soldiers == maxSoldiers`）の場合グレーアウトで選択不可
- **上限増**: 対象キャラの `maxSoldiers` + 50

効果値（補充ロジック・上限増+50）は**コード固定**（JSON で持たない）。

### 3.3 限定コマンド（独自効果・単択 UX）

- コマンドごとに独自の効果を JSON で定義
- 実行時の 2択 UX は無し、選択で即効果適用（単択）
- 効果対象スコープ: 実行キャラのみ固定
- 行動力消費 1（汎用と同じ、可変なし）
- 同ターン内に同一限定コマンドを行動力と uses が許す限り何度でも実行可

### 3.4 uses（使用回数）管理

- `maxUses`: コマンドごとに JSON で上限定義
- 加算経路: `grantPromotionUses` effect のみ（イベント / クラファン経由）
  - 形式: `{ type: 'grantPromotionUses', commandId: <id>, value: <N> }`
  - 加算時は `maxUses` でクランプ（超過分は捨てる）
- 減算: コマンド実行で `-1`
- 新規ゲーム開始時の `uses`: 全限定コマンド 0
- `unlockedCommands` Set: 一度でも `uses` が加算された限定コマンド ID を保持。`grantPromotionUses` 初回加算時に追加
- UI 表示ロジック:
  - `limited:false` → 常時表示
  - `limited:true && unlockedCommands.has(id) && uses>=1` → 通常表示
  - `limited:true && unlockedCommands.has(id) && uses==0` → **グレーアウト表示**（取得履歴を見せる）
  - `limited:true && !unlockedCommands.has(id)` → 非表示

### 3.5 UI 差別化

- 汎用3種と限定コマンドは**同一リスト内に混在**表示
- 限定コマンドは限定マーク（バッジ等）で視覚的に区別
- uses 残量を限定コマンドに表示

### 3.6 データ駆動方針

- コマンド詳細はすべて JSON（`src/game/data/promotion_commands.json`）に格納
- 実装側は id と `limited` 種別フラグで分岐、限定コマンドの効果は JSON の `effects` 配列を実行時にコード側ロジックで適用
- 汎用3種の効果（補充 / 上限増+50）はコード固定（汎用3種に `effects` 配列を書かない）
- エディタ統合（`tools/editor-modules/` への追加）は P2-2 で別途

### 3.7 JSON スキーマ

**汎用コマンド**:
```json
{ "id": "video", "name": "動画収録", "limited": false }
```

**限定コマンド**:
```json
{
  "id": "holy_land_collab",
  "name": "聖地コラボイベント",
  "limited": true,
  "maxUses": 3,
  "effects": [
    { "type": "add", "key": "maxSoldiers", "value": 200 },
    { "type": "add", "key": "soldiers", "value": 200 }
  ]
}
```

- `effects` の形式は §4.4 クラファンと同一（`{ type: 'add'|'mul'|'set', key, value }`）
- `target` フィールドなし（実行キャラのみ固定）
- `actionCost` フィールドなし（全コマンド1固定）

### 3.8 デバッグ用ダミー2件

P2 隔離開発環境用のダミー限定コマンド（本番仕様は別タスク）:

```json
[
  { "id": "video",           "name": "動画収録",       "limited": false },
  { "id": "song",            "name": "歌",             "limited": false },
  { "id": "official_assets", "name": "公式素材供給",   "limited": false },
  {
    "id": "holy_land_collab",
    "name": "聖地コラボイベント",
    "limited": true,
    "maxUses": 3,
    "effects": [
      { "type": "add", "key": "maxSoldiers", "value": 200 },
      { "type": "add", "key": "soldiers", "value": 200 }
    ]
  },
  {
    "id": "official_mv",
    "name": "公式MV制作",
    "limited": true,
    "maxUses": 5,
    "effects": [
      { "type": "add", "key": "soldiers", "value": 100 },
      { "type": "add", "key": "charSong", "value": 1 }
    ]
  }
]
```


---

## 4. クラファン仕様（確定分）

### 4.1 挑戦条件

- 参加者全員の `soldiers >= 300`（単独挑戦・複数人挑戦とも同条件）
- 複数人挑戦は全ゴール種で可能（種別による制限なし）

### 4.2 フロー

1. 挑戦キャラ選択（1人または複数人、全員 `soldiers >= 300` 必須）
2. **第一ゴールをプレイヤーが手動選択**（4候補から1つ）
3. 初戦
   - 敗北 → 終了
   - 勝利 → ストレッチゴールが自動設定（重み付き抽選）→ 次戦闘
4. 連戦デスマッチ（迷宮型）
   - 挑戦者全員 HP=0 で終了
   - 1体倒すごとに次のストレッチゴールが自動設定 → 次の敵が出現
   - 倒すたびに敵強化（連勝補正）
   - 戦闘間にミーム全回復
   - 達成ゴール = 第一ゴール + 倒したストレッチ全部
5. 精算（敗北時も含む）
   - 参加者全員の `maxSoldiers` と `soldiers` を **50** にリセット
   - 達成したゴールごとの効果を適用（複数人挑戦の場合、全参加者に効果適用）
   - 最後に `soldiers` を `maxSoldiers` まで回復
6. 終了

### 4.3 ゴール種別

#### 第一ゴール（プレイヤー手動選択・4種固定）

| 種別 | 内容 |
|------|------|
| `software_dev` | 未開発ソフト1つ（挑戦キャラ本人の未開発ソフトからプレイヤーが一覧選択） |
| `event` | イベント開催（効果は `grantPromotionUses`、常時選択可） |
| `merchandise` | グッズ制作 |
| `anime_production` | アニメ制作 |

#### ストレッチゴール（戦闘勝利ごとに重み付き抽選・自動設定）

| 種別 | 内容 |
|------|------|
| `ex_voice` | EXボイス収録 |
| `model_3d` | 3Dモデル制作 |
| `demo_song` | デモソング |
| `software_dev` | 未開発ソフト1つ（挑戦キャラ本人の未開発ソフトから自動抽選） |
| `software_new_char` | 特定キャラ限定の新規キャラ開発（例: 雨晴はう挑戦時「相良汐ボカロ化」） |

抽選ルール:
- 重みは**ゴール種別ごとに固定**（コード or 別 JSON でマップ管理、JSON フィールドではない）
- 特定キャラ限定ストレッチは、各ストレッチゴール JSON に `available_for: [char_id]` フィールドを持ち、挑戦者の id がリストに含まれる場合のみ抽選プールに加わる
- 重複排除（同戦闘内で同ゴール重複可否）は別途検討、暫定で重複なし

### 4.4 効果

- 効果単位: ゴール単位、1ゴール N effect 可
- 効果値形式: `{ type: 'add'|'mul'|'set', key, value }`
- 編集対象キー（案I 全候補）:
  `maxSoldiers` / `charMaxHp` / `strategyRate` / `soldierAtk` / `soldierDef` / `charAttack` / `charDefense` / `charSong` / `attackCount` / `recoveryRate` / `skillId` / `specialType` / `grantPromotionUses`
- VerUp 廃止（`versionCap` / `versionup` フィールド不要）
- 複数人挑戦時、効果は参加者全員に適用

### 4.5 例（ユーザー提示）

クラファンにて以下を全達成した場合:
| 達成ゴール | 種別 | 効果 |
|-----------|------|------|
| AI Voice 開発 | 第一: software_dev | `charHp +10` / `charAttack +3` / `charDefense +2` / `attackCount +20` |
| EX ボイス追加 | ストレッチ: ex_voice | `soldierAtk +1` |
| グッズ開発 | 第一: merchandise | `maxSoldiers +50` |
| 3Dモデル作成配布 | ストレッチ: model_3d | `soldierDef +1` |

注: 1挑戦で第一ゴールは1つのみ選択可。上表は複数回挑戦の累積例。
加えて挑戦キャラの `maxSoldiers` が 50 にリセットされる（精算規則）。

### 4.6 バランス設計意図

- 300 ギリで挑戦＝弱い敵想定ではない（敵の強さはゴール設定で決定、挑戦キャラ戦闘力と無関係）
- ただし 300 ギリのキャラは戦闘力が低い傾向で連戦に耐えられない → ストレッチ未達 → 精算で `maxSoldiers=50` リセット → 再挑戦に必要なミーム蓄積が遅い
- 大量蓄積で挑戦＝戦闘力高 → ストレッチ多数達成 → `maxSoldiers` ボーナスで再起早い
- 複数人挑戦時は精算リセット・効果適用とも全員 → 全体で均等に育成 / 全体で均等にダウンサイド

### 4.7 敵能力

- ゴールごとに JSON 固定（ベース能力）
- 連勝補正式: `base + N × δ`（N = 連勝数）
- δ 定義位置: **グローバル一括**（コード or 専用 JSON で全ゴール共通の単一セット、ステ別キーごとに値定義）
- 挑戦キャラ戦闘力との相対調整なし
- プレイヤー進行度（拠点数等）でのスケールなし

### 4.8 イベント連動

- クラファン終了時 trigger は **P3 で新規追加**（現状の EventEngine には未実装）
- 終了時イベントで `grantPromotionUses` 等の effect も発動可

### 4.9 戦闘モード

- 連戦制御は BattleScene 外部（GameContext 等）で実装
- 単体戦闘は既存 `battleMode='duel'` を流用（無限ラウンド・撤退不可）
- 複数人挑戦時は同時パーティ出撃（BattleEngineV3 の複数人 vs 単体敵への対応可否は実装着手前に Code が確認・報告）


---

## 5. 劇場仕様（確定分）

- 1キャラ5イベント構造は **既存スキーマで表現可**（`id` / `conditions[]` / `effects[]`）
- `_index.json` と命名規約で管理、新フィールド追加なし
- 発生条件は既存条件型（`flag` / `turn` / `treasury` / `baseControlled` 等）で足りる
- 新 effect: **`grantPromotionUses(id, n)`** を追加
  - 引数: コマンド id + 加算回数
  - 劇場以外のイベント（クラファン終了等）からも呼ばれる汎用 effect
  - 1イベント内に複数 effect を並べることで複数コマンドを同時加算可能
- キャラクリ報酬は effect の器のみ用意、内容は後続

### ユーザー指示の重要原則

「ボイス収録 / グッズ制作 / コラボイベント」等は**フレーバーではなくそれぞれ明確に異なる**コマンド/ゴール。
**実装側でコマンド詳細を持たず、すべてエディタ駆動の JSON で管理**。

---

## 6. 仲間画面（確定）

- 強化コマンド削除（`sp_refill` / `sp_max_up`）
- 全キャラパラメータ閲覧のみ
- 個別キャラ強化はクラファン経由のみ
- データ層（`upgradeUnlocks` / `purchasedUpgrades`）は温存

---

## 7. SP → ミーム呼称（P5）

UI 文字列のみ「SP」→「ミーム」に置換。
フィールド名 `soldiers` 据置。
通貨ミーム（`treasury`）は UI 廃止で呼称衝突解消。
`PartnerWidget.jsx` L132「敵兵力」→「敵ミーム」も同時置換（D-2 確定）。
P5 は P1〜P4 完了後の総仕上げ。

---

## 8. データ層変更点（フェーズ別）

### P1
- `src/game/data/characters.json`: 全キャラから `battleCapacity` フィールド削除
- 着手前に再度 grep で参照箇所ゼロ確認（現時点での確認結果は本書 §1 通り）
- **D-1**: `MapScene.jsx:415` の `troops` 生成行を削除（NodePopup「防御部隊」表示行の削除と同時。参照ゼロのため死にデータ化を回避）
- **D-3**: TopBar の通貨 / income 表示位置は Code に実物確認させて削除（Chat 側で先行特定はしない）

### P2
- `src/game/data/promotion_commands.json` 新設
- `state.promotionCommandUses: { [id]: count }` 新設
- 既存 `actionPoints` プールから消費

### P3
- `src/game/data/softwares.json` 新設（旧 `DESIGN_software_dev.md` §3.2 スキーマ流用、`versionCap`/`versionup` 削除）
- `src/game/data/crowdfunding_goals.json` 新設（`special` ゴール等）
- `characters.json` に `engines` フラグ追加
- `char.engineDev` ランタイム追加
- `SAVE_VERSION` 繰り上げ + 旧セーブに `engineDev`/`engines` 補填
- クラファン終了 trigger を EventEngine に追加
- 連戦バトル制御（既存 BattleScene の流用 or 拡張、方式は保留）

### P4
- `EventEngine` に `grantPromotionUses` 等の新 effect 追加
- `events/theater/*.json` の整備（1キャラ5イベント）

### P5
- UI 文字列のみ置換（フィールド名据置）


---

## 9. 保留事項

### クラファン
- `software_dev` ゴールの表現方法:
  - 案A: ソフトごとに個別ゴールJSONを用意（`softwareId`固定 + `effects`固定）
  - 案B: `software_dev` は汎用ゴール1枠とし、`softwareId` は実行時選択、効果はソフト側データに持たせる
  - P3-1 devmode のフロー検証には影響しないが、P3-2 本体移植前に統一が必要

### 劇場
- キャラクリ報酬の具体内容（後続）

### E系統（ドキュメント運用）
- E-1: 旧 `DESIGN_software_dev.md` の archive 移動タイミング
- E-2: `KNOWLEDGE.md` への反映タイミング
- E-3: 本書の確定事項を `DESIGN_V2.md` / `PHASE_PLAN_V2.md` に反映するタスクの取り回し

---

## 10. 次のアクション選択肢

| 案 | 内容 |
|---|---|
| 1 | 本書の確定事項を `DESIGN_V2.md` / `PHASE_PLAN_V2.md` に反映（Code 引き継ぎプロンプト化） |
| 2 | D系統 詰め → P1 引き継ぎプロンプト化 |
| 3 | クラファン保留事項 Q1〜Q7 詰め |
| 4 | E系統 詰め |
| 5 | キャラクリ報酬の具体仕様詰め |

---

## 11. 関連ファイル

- `/Users/kamatashintarou/MCP_Learning/kiritan_r/docs/DESIGN_V2.md`（俯瞰、本書より古い）
- `/Users/kamatashintarou/MCP_Learning/kiritan_r/docs/PHASE_PLAN_V2.md`（P1-P5 詳細、本書より古い）
- `/Users/kamatashintarou/MCP_Learning/kiritan_r/KNOWLEDGE.md`（プロジェクト状態）
- `/Users/kamatashintarou/MCP_Learning/kiritan_r/docs/DESIGN_software_dev.md`（旧layer1・P3 着手時に archive 移動候補）

---

## 12. 議論経緯の要点（引き継ぎメモ）

- 訓練と汎用コマンドは別物ではない。「訓練コマンド」という独立コマンドは存在せず、プロモーション画面のコマンド = 動画収録 / 歌 / 公式素材供給 + 劇場経由追加分の総体
- `characters.json` の `battleCapacity` は死にデータ。戦闘で機能する `battleCapacity` は `bases.json` 由来（拠点単位）
- `strategyRate` = 「策略」。両陣営最大値の差分で SP ダメージに ±10〜50% 補正（`BattleEngineV3` 参照）
- クラファンの敵能力は **挑戦キャラ戦闘力とは無相関**。プレイヤーが設定するゴール群と連勝補正のみで決まる
- `grantPromotionUses` は劇場専用ではない汎用 effect。イベント全般（劇場 / クラファン終了 / 他）から呼ばれる
- ユーザー指示の核心: 「実装側でコマンド詳細を持つな、すべて JSON とエディタで管理」
