# PROMPT: ダンジョン2画面のUIデザイン

対象: **ClaudeDesign**
作成: 2026-08-26
納品形式: JSX（ロジック接続は範囲外。レビュー後に ClaudeCode がマージする）

---

## 0. 立場と範囲

**あなたが作るのは見た目だけ。** state・イベントハンドラ・データ取得は一切書かない。
props で受け取った値を表示し、コールバックを呼ぶところまで。

対象は2画面。

| # | 画面 | 現状 |
|---|---|---|
| A | ダンジョン種別選択 | `src/App.jsx` の `case 'dungeon_select'` にインラインで直書き。**独立したシーンファイルが無い** |
| B | ダンジョン本体 | `src/scenes/DungeonScene.jsx`。Phase C で機能実装されたが見た目は未整備 |

**両方とも他シーンと見た目が揃っていない。** これが直したい点。

---

## 1. デザイントークン（`src/shared/tokens.js`）

**色を直書きするな。必ず import しろ。** 実在する export は以下がすべて。

```js
PK='#c4427a'   PK2='#9e2d5f'          // 主色（ピンク）
AC='#b87010'   AC2='#d4a044'          // 副色（琥珀）
TEAL='#1a8a96'                        // 対比色
TX='#1c1020'   TXD='rgba(28,16,32,.55)'  TXF='rgba(28,16,32,.24)'  // 文字
BR='rgba(0,0,0,.08)'                  // 罫線
BG_LIGHT='rgba(248,246,244,1)'  BG_LIGHT2='rgba(240,234,228,1)'
PANEL_LIGHT='rgba(255,253,251,.94)'
glass(extra)                          // 半透明パネルのスタイル関数
```

`tokens.js` に `GAME_STATE` / `CHARS` / `ROLES` も export されているが、**これらは旧モックデータ。使うな。**

**基準にする画面は `src/scenes/FormationScene.jsx`。** Design v4 相当で最も整っている。
`SlotRow` / `CharCard` / `BattleModeToggle` / `BattlefieldPreview` の組み方・余白・
見出しの `FONT_DISPLAY` + `letterSpacing:'.22em'` の扱いを踏襲しろ。新しい様式を発明するな。

---

## 2. 画面A — ダンジョン種別選択

`src/scenes/DungeonSelectScene.jsx` として**新規に切り出す**。

現状は素のボタン2つと戻るボタンだけで、背景色も文字色も直書き。

### props（この形で受け取れ。増やすな）

```js
export default function DungeonSelectScene({
  onSelect,    // (dungeonKind) => void  — 'crowdfunding' | 'shallow'
  onCancel,    // () => void — マップへ戻る
})
```

### 表示要件

- 2種別を対等に並べる。片方が主でもう片方が従、という関係ではない
- **クラファン挑戦**（`PK` 系）— SP上限を賭けて挑む。失敗すると没収される
- **浅層探索**（`TEAL` 系）— 低リスク。SPを稼ぐ
- それぞれに1〜2行の説明文を添える。**文面はダミーでよい**が、上記の性格差が伝わる長さにしろ
- 戻る導線を1つ

---

## 3. 画面B — DungeonScene

`src/scenes/DungeonScene.jsx` を差し替える。**props の契約を変えるな。**

### props（現行のまま）

```js
dungeonKind        // 'crowdfunding' | 'shallow'
goals              // クラファンのゴール一覧（dungeons.json の goals）。浅層探索では未使用
availableChars     // 選択可能なキャラ配列
remainingRounds    // 残ラウンド数
waveIndex          // これから戦う波の番号。0 = 未着手
goalAchieved       // クラファン: 進捗100%達成済みか
progressPoints     // クラファン: 累積進捗ポイント
progressRequired   // クラファン: 100%到達に必要な進捗ポイント
battleResult       // 'win' | 'lose' | null
sessionEnded       // true なら結果表示後マップへ自動遷移
rewardInfo         // { kind, delta, charNames } | null
milestoneHit       // 進捗の100%刻みに新たに到達したか
onConfirm          // (charIds, goalId, mainCount) => void
onContinue         // () => void — 「進む」
onRest             // () => void — 「休む」（HP全回復・ラウンド5消費）
onEndSession       // () => void — 「終了する」
onNavigate         // (scene) => void
```

### 内部 state（現行のまま。増やすな）

```js
phase              // 'select' | 'wave_result' | 'continue_or_rest'
selectedCharIds    // 最大4名
selectedGoalId     // クラファンのみ
mainCount          // 1 | 2 — MainCountToggle で選ぶ
```

### phase ごとの要件

**`select`** — 出撃編成を決める画面。

- クラファンのみゴール選択を出す（`goals`）。浅層探索では出さない
- キャラ選択リスト。**最大4名**。5人目は選べない
- `MainCountToggle`（`FormationScene.jsx` から import 済み。**そのまま使え。作り直すな**）
- 決定ボタン。`selectedCharIds.length === 0` またはクラファンでゴール未選択なら非活性
- **クラファンは挑戦時に SP上限が没収される。** 選んだキャラが何を賭けるのかが読み取れること

**`wave_result`** — 1波の結果表示。一定時間で自動遷移する。

- 勝敗（`battleResult`）
- 報酬（`rewardInfo`）が出たときの見せ方
- `milestoneHit` は進捗の節目。演出上の強調が要る

**`continue_or_rest`** — 次の波へ進むか休むか。

- 残ラウンド（`remainingRounds`）は消費資源。**減っていくことが緊張として伝わること**
- クラファンは進捗（`progressPoints` / `progressRequired` / 百分率）を主役に置く。浅層探索には進捗が無い
- 「進む」「休む」「終了する」の3択。休むはラウンド5消費、終了は成果確定

---

## 4. 制約

- **`props` と内部 state の名前・型・個数を変えるな。** Code がマージできなくなる
- **色・フォントの直書き禁止。** `tokens.js` から import
- `MainCountToggle` は既存を import して使う。見た目を変えたいなら
  `FormationScene.jsx:367` の当該コンポーネントを直接書き換えて提出しろ（両画面で共有されている）
- ロジック（`useEffect` の自動遷移・`onConfirm` の引数構築など）は現行の実装を保て
- 1ファイル1コンポーネントの分割はしなくてよい。既存シーンと同じく1ファイルに収めろ
- 画面Aは新規ファイル。`App.jsx` からの呼び出し差し替えは **Code の担当**。あなたは書くな

---

## 5. 納品時に添えること

- 変更・新規のファイル一覧
- `tokens.js` から使った定数の一覧
- props / state を変更していないことの明示
- ダミー文言を入れた箇所（後で人間が差し替える）

---

## 6. 補足（判断材料）

- クラファンと浅層探索は**同一フォーマットの別モード**。共通の骨格に差分を乗せる作りが正しい
- ダンジョンは MAP 下部の BottomBar から入る。マップへ戻る導線を必ず残せ
- 体験版の範囲に含まれる画面。**遊べる状態で人目に触れる**
