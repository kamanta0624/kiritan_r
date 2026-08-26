# PROMPT_P3_crowdfunding_devmode.md — P3-1 クラファン画面 隔離開発（フロー版）

> 種別: Code 引き継ぎ（実装）
> 本書は **P3-1（隔離 devmode・フロー検証）**。P3 本体実装ではない。
> 親仕様: `docs/prompts/PROMPT_v2_design_continuation.md` §4 クラファン仕様
> 方針: 完全新機能・複雑度高のため隔離開発。**本体組み込み禁止**、デバッグ環境で UI フロー検証 → 完成後に本体載せ替え
> 戦闘エンジン連携（duel モード・複数人パーティ・連勝補正の実適用）は **P3-2 で別途**。本書は戦闘モック（勝ち/負けボタン）まで
> QA: 人間が担当

### 用語・モデル（本体整合）
- `engines`: そのキャラが**保有/対応**するソフト（availability・0/1マップ）。
- `engineDev`: その周回で**開発済み**のソフト（0/1マップ）。`developEngine` 相当で 0→1。
- **mainChallenger**: `selectedCharIds[0]`（挑戦キャラの先頭）。`software_dev` の対象判定・開発フラグ更新はこの主挑戦者を基準にする。
- `ownedSoftware` という名称は使わない（保有/開発の区別が崩れるため）。

---

## 0. 原則

- **本体（GameContext, BottomBar, BattleEngineV3 等）には一切手を入れない**
- 隔離 dev シーンとして独立動作、`?qa=crowdfunding` URL でアクセス
- データ駆動: ゴール詳細・効果・敵能力・重み・δ は JSON、実装側は適用ロジックのみ
- デザイントークン import、色直書き禁止
- 指示範囲外を変えない、不明点は Chat に確認

---

## 1. スコープ（成功基準）

### 1.1 デバッグ環境構築

- `?qa=crowdfunding` URL で `CrowdfundingDevScene` 起動
- `?qa=battlefull` / `?qa=promotion` 既存パターンに倣う
- App.jsx の QA 分岐部分のみ追加、通常フローへの影響禁止

### 1.2 crowdfunding_goals.json 新規作成

パス: `src/game/data/crowdfunding_goals.json`

注意:
- このJSONは **P3-1 フロー検証用の仮データ**。本番バランス値ではない。
- `enemy` 能力値・`effects` 数値・ゴール名は devmode 用サンプル。後続でエディタ/本番データに置き換える。

スキーマ例（初期サンプル）:
```json
[
  {
    "id": "ai_voice_dev",
    "type": "software_dev",
    "category": "primary",
    "name": "AI Voice 開発",
    "softwareId": "ai_voice",
    "enemy": { "soldiers": 300, "charAttack": 5, "charDefense": 3, "charSong": 1 },
    "effects": [
      { "type": "add", "key": "charMaxHp",  "value": 10 },
      { "type": "add", "key": "charAttack", "value": 3 },
      { "type": "add", "key": "charDefense","value": 2 },
      { "type": "add", "key": "attackCount","value": 20 }
    ]
  },
  {
    "id": "event_hall",
    "type": "event",
    "category": "primary",
    "name": "イベント開催",
    "enemy": { "soldiers": 250, "charAttack": 4, "charDefense": 3, "charSong": 1 },
    "effects": [
      { "type": "grantPromotionUses", "commandId": "holy_land_collab", "value": 1 }
    ]
  },
  {
    "id": "goods_dev",
    "type": "merchandise",
    "category": "primary",
    "name": "グッズ開発",
    "enemy": { "soldiers": 280, "charAttack": 4, "charDefense": 4, "charSong": 1 },
    "effects": [
      { "type": "add", "key": "maxSoldiers", "value": 50 }
    ]
  },
  {
    "id": "anime_basic",
    "type": "anime_production",
    "category": "primary",
    "name": "アニメ制作",
    "enemy": { "soldiers": 400, "charAttack": 6, "charDefense": 5, "charSong": 1 },
    "effects": [
      { "type": "add", "key": "maxSoldiers", "value": 100 },
      { "type": "add", "key": "charAttack",  "value": 2 }
    ]
  },
  {
    "id": "ex_voice_basic",
    "type": "ex_voice",
    "category": "stretch",
    "name": "EX ボイス追加",
    "enemy": { "soldiers": 350, "charAttack": 5, "charDefense": 4, "charSong": 1 },
    "effects": [{ "type": "add", "key": "soldierAtk", "value": 1 }]
  },
  {
    "id": "model_3d_basic",
    "type": "model_3d",
    "category": "stretch",
    "name": "3Dモデル制作",
    "enemy": { "soldiers": 380, "charAttack": 5, "charDefense": 5, "charSong": 1 },
    "effects": [{ "type": "add", "key": "soldierDef", "value": 1 }]
  },
  {
    "id": "demo_song_basic",
    "type": "demo_song",
    "category": "stretch",
    "name": "デモソング",
    "enemy": { "soldiers": 360, "charAttack": 6, "charDefense": 3, "charSong": 2 },
    "effects": [{ "type": "add", "key": "charSong", "value": 1 }]
  },
  {
    "id": "yumahau_aikato_dev",
    "type": "software_new_char",
    "category": "stretch",
    "name": "相良汐ボカロ化",
    "softwareId": "aikato_vocaloid",
    "available_for": ["yumahau"],
    "enemy": { "soldiers": 500, "charAttack": 8, "charDefense": 6, "charSong": 2 },
    "effects": [{ "type": "add", "key": "charMaxHp", "value": 20 }]
  }
]
```

スキーマ仕様:
- `id`: ゴール一意ID
- `type`: ゴール種別（§4.3 の種別文字列）
- `category`: `"primary"` | `"stretch"`
- `name`: 表示名
- `softwareId`: `type==='software_dev'` または `'software_new_char'` のとき必須
- `available_for`: 配列または省略。配列の場合、参加者のいずれかの id が含まれるときのみ抽選プール入り
- `enemy`: 敵ベース能力（連勝補正前）。`soldiers`/`charAttack`/`charDefense`/`charSong`
- `effects`: クラファン §4.4 形式

### 1.3 重み・δ の定義（コード固定）

P3-1 ではコード固定で着手（JSON 化は P3-2 以降検討）。

ストレッチ抽選重み（種別 → 数値）:
- `ex_voice`: 3
- `model_3d`: 3
- `demo_song`: 3
- `software_dev`: 2
- `software_new_char`: 5

連勝補正 δ（key → 数値、ステ別グローバル一括）:
- `soldiers`: 50
- `charAttack`: 1
- `charDefense`: 1
- `charSong`: 0

配置: `CrowdfundingDevScene.jsx` 内の定数 or 別 const ファイル（Code 裁量）。

### 1.4 CrowdfundingDevScene 実装

新規ファイル: `src/scenes/CrowdfundingDevScene.jsx`

#### 1.4.1 モック state

```js
const [mockChars, setMockChars] = useState([
  {
    id:'kiritan', name:'東北きりたん',
    soldiers:300, maxSoldiers:400, charMaxHp:30, charAttack:5, charDefense:3, charSong:1, attackCount:50, soldierAtk:1, soldierDef:1,
    engines:   { ai_voice:1, aikato_vocaloid:0 },
    engineDev: { ai_voice:0, aikato_vocaloid:0 },
  },
  {
    id:'zundamon', name:'ずんだもん',
    soldiers:400, maxSoldiers:500, charMaxHp:35, charAttack:6, charDefense:4, charSong:1, attackCount:60, soldierAtk:1, soldierDef:1,
    engines:   { ai_voice:1, aikato_vocaloid:0 },
    engineDev: { ai_voice:1, aikato_vocaloid:0 },
  },
  {
    id:'yumahau', name:'雨晴はう',
    soldiers:350, maxSoldiers:400, charMaxHp:30, charAttack:5, charDefense:3, charSong:2, attackCount:55, soldierAtk:1, soldierDef:1,
    engines:   { ai_voice:1, aikato_vocaloid:1 },
    engineDev: { ai_voice:0, aikato_vocaloid:0 },
  },
]);
const [phase, setPhase] = useState('select_chars');  // 'select_chars' | 'select_primary' | 'battle' | 'settlement'
const [selectedCharIds, setSelectedCharIds] = useState([]);
const [primaryGoal, setPrimaryGoal] = useState(null);
const [currentGoal, setCurrentGoal] = useState(null);
const [winStreak, setWinStreak] = useState(0);
const [achievedGoals, setAchievedGoals] = useState([]);
```

#### 1.4.2 フロー UI（4フェーズ）

**Phase A: 挑戦キャラ選択**
- mockChars 一覧、複数選択チェックボックス
- 全員 `soldiers >= 300` でないと「次へ」グレーアウト
- `selectedCharIds[0]` を **mainChallenger** として扱う（選択順を保持）
- 「次へ」→ Phase B

**Phase B: 第一ゴール選択**
- `category==='primary'` のゴール4種を表示
- `software_dev` 系は「未開発ソフト一覧から選択」サブ UI
  - 候補は **mainChallenger の `engines[softwareId]===1` かつ `engineDev[softwareId]===0`** のソフトのみ
  - 複数人挑戦でも、第一ゴールの software_dev 対象判定は mainChallenger 基準
- ゴール選択 → primaryGoal セット、currentGoal にも同値、winStreak=0、Phase C へ

**Phase C: 連戦フロー**
- 現在のゴール表示（敵能力に連勝補正 `base + N × δ` を適用した値も表示）
- 戦闘モック: 「勝ち」「負け」2ボタン（実戦闘なし）
  - 「勝ち」→ achievedGoals に currentGoal 追加、winStreak +1
    - ストレッチ自動抽選プール構築:
      - `category==='stretch'`
      - `available_for` が null か、参加キャラの誰かが該当
      - `type==='software_dev'` の場合、mainChallenger の未開発ソフト候補のみ
      - 既に achievedGoals に含まれない（同戦闘内重複なし）
    - 重み付き抽選 → currentGoal 更新 → 次戦闘
    - プール空 → Phase D
  - 「負け」→ Phase D

**Phase D: 精算**
- 達成ゴール一覧（第一 + 倒したストレッチ）
- 全参加者の `maxSoldiers` と `soldiers` を 50 にリセット
- 各達成ゴールの effects を全参加者に適用
- 達成ゴールが `type==='software_dev'` の場合:
  - mainChallenger の `engineDev[goal.softwareId]` を `1` にする
  - すでに `1` の場合は変更しない
  - effects は通常どおり参加者全員に適用
- 達成ゴールが `type==='software_new_char'` の場合:
  - P3-1 devmode では本来の新規キャラ解禁処理は行わない
  - `available_for` による抽選プール投入と effects 適用のみ検証する
- `soldiers` を `maxSoldiers` まで回復
- 結果プレビュー（更新前後の値）
- 「完了」→ Phase A に戻る（state リセット）

#### 1.4.3 effects 適用ロジック

- `type:'add'` / `'mul'` / `'set'` → 通常の数値演算
- `type:'grantPromotionUses'` は `add/mul/set` とは別の special effect type
  - 形式: `{ "type":"grantPromotionUses", "commandId":"...", "value":1 }`
  - P3-1 devmode ではデバッグ表示「コマンド `${commandId}` の uses +${value}」コンソール出力（実適用は本体未組込のためなし）
- `type:'software_dev'` ゴール達成時の `engineDev[softwareId]=1` は effects 配列ではなく、ゴール達成処理として扱う

#### 1.4.4 デバッグ機能

- 「リセット」: 全 state を初期値に
- 「ストレッチ抽選デバッグ」: 抽選プール内容・各候補の重み・選択結果ログ
- 「δ ログ」: 連勝補正計算過程

### 1.5 共通部品の分離

本体載せ替え準備（プロモーション §1.4 同方針）:
- フロー UI（キャラ選択 / ゴール選択 / 精算プレビュー）は再利用可能関数コンポーネント
- state 接続層は local state、本体載せ替え時は GameContext へ
- ロジック層（抽選・効果適用・連勝補正）は純粋関数で分離

---

## 2. 範囲外（やらない）

- 本体への組み込み
- BattleEngineV3 連携・duel モード実適用（P3-2 で別途）
- 複数人パーティ vs 単体敵の戦闘実装（P3-2）
- `grantPromotionUses` effect の本体 EventEngine 実装（P4）
- クラファン終了 trigger 新規追加（P4）
- エディタ統合（後続）
- 既存シーンの挙動変更

---

## 2.5 保留事項（P3-2 本体移植前に確定）

- **`software_dev` ゴールの表現方法**: 「ソフトごとに個別ゴールJSON（softwareId固定＋effects固定）」か、「software_dev は汎用ゴール1枠で softwareId は実行時選択・effects はソフト側が持つ」かで2解釈が混在。
  - P3-1 のフロー検証には影響しないが、本体移植前に統一が必要。
  - 親仕様 `PROMPT_v2_design_continuation.md` §9 にも同項目を記載。

---

## 3. 着手前の事前報告

1. `?qa=` パターン実装箇所（App.jsx の QA 分岐の行番号と構造）
2. `software_dev` 未開発判定の実装案（mainChallenger の `engines[softwareId]===1 && engineDev[softwareId]===0` を使うこと）
3. `software_new_char` 抽選プール構築ロジック（参加キャラ id と `available_for` の突合方式）
4. UI レイアウト 4フェーズの大枠案

1メッセージで報告 → Chat 確認 → 着手。

---

## 4. 完了後の報告

§1.1〜§1.5 の達成状態を1項目ずつ列挙。
モック戦闘「勝ち/負け」ボタン挙動も明記。
`npm run build` の成否を報告（これはQAではなく実装完了確認）。
QA は人間が担当のため Code 側 QA はなし。
