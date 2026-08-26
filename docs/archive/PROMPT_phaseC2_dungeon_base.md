# PROMPT_phaseC2_dungeon_base — ダンジョン基盤改修（Phase C-2）

対象: ClaudeCode
参照必須: `docs/DESIGN_CROWDFUNDING.md`（仕様SSOT）§1-2 / §2-2 / §2-3 / §2-4
関連: `KNOWLEDGE.md` §7（GameContext API）

C-1（戦闘システム）とは独立。並行して進めてよい。C-3 は本プロンプトに依存する。

---

## 0. 成功基準

達成するまでループして直すこと。

1. `npm run build` が成功する
2. 拠点メニューから「迷宮」コマンドが消えている
3. **BottomBar の新規ボタンからダンジョンに入れる**
4. **複数キャラ（最大4名）を選んで挑戦できる**（現状は単騎）
5. ダンジョン画面に**残ラウンド数が表示され、戦闘のたびに減る**
6. 1戦目7ラウンド・2戦目5ラウンドなら残ラウンドが 40 → 33 → 28 と減る
7. **休憩を選ぶと1ラウンド消費し、全員の SP が +50 / HP が +5 される**
8. 残ラウンドが 0 を下回った時点で強制帰還する
9. 旧セーブ（`dungeonProgress` を含む v10）をロードしてもエラーが出ない

---

## 1. 「ダンジョン」の再定義

**ダンジョンは場所ではない。** クラファン挑戦と浅層探索が共通で使う「フロア制の連戦フォーマット」。

拠点付属の迷宮（盛岡＝龍泉洞）という概念を廃止する。

### 撤去するもの

| 対象 | 箇所 |
|------|------|
| 「迷宮 DUNGEON」コマンド | `src/scenes/BaseMenuScene.jsx:23` |
| `hasDungeon` prop | `src/App.jsx:351` |
| `dest === 'dungeon'` 分岐 | `src/App.jsx:355-356` |
| `dungeonId` フィールド | `src/game/data/bases.json`（`base_012` のみ値あり。**フィールドごと削除**） |
| `baseId` | `src/game/data/dungeons.json` |

### 残すもの（流用）

`DungeonScene.jsx` のフロー（`select → floor_intro → battle → floor_result → adv / next_or_escape → dungeon_cleared`）、`dungeons.json` のフロア・敵定義、`state.dungeonProgress` / `dungeonExploredThisTurn`、`actions.dungeonFloorClear` / `dungeonExplored` / `dungeonDefeat`。

---

## 2. 入口を BottomBar へ付け替え

`src/shared/SharedUI.jsx` の `BottomBar`（`:84-86` 付近に既存の NavButton が並ぶ）に**ダンジョンへの導線を追加**する。

**当面は暫定UIでよい**（将来まとめて直す方針）。`App.jsx` の `renderScene` に既にある `case 'dungeon'`（`:619`）へ遷移できればよい。

`sceneParams` に `baseNode` を渡していた前提（`:621` で `baseNode?.dungeonId` を引く）が崩れるため、**ダンジョンIDを直接渡す形に変える**こと。

現状 `dungeons.json` は `dungeon_001`（龍泉洞）1件のみ。**複数ダンジョンから選ぶUIは不要**。1件を直接開いてよい。

---

## 3. 複数キャラ挑戦への拡張

現状は単騎（`App.jsx:35` の `dungeonFlow = { dungeonId, explorerCharId, floor, baseNode }`）。

**最大4名を選べるようにする。** 編成の考え方は通常戦闘と同じ（1・2人目＝メインキャスト、3・4人目＝サブキャスト）。

- `dungeonFlow` の `explorerCharId`（単数）を配列へ
- `DungeonScene` の `phase: 'select'` を複数選択に対応
- `actions.dungeonDefeat(charId)` は単騎前提（`charHp=1` / `soldiers=0` / `penaltyTurns=2`）。**複数キャラに対応させる**
- 戦闘への受け渡しは既存の `formation` 形式（`{ front1, front2, rear1, rear2 }`）に合わせる

選択可能条件は通常戦闘と同じ（`!usedThisTurn && soldiers>0 && !(penaltyTurns>0)`）でよいが、**ダンジョン探索は `soldiers=0` でも可**という既存仕様（`KNOWLEDGE.md` §7 の `availableChars` 注記）がある。**現状維持とし、変更しないこと。**

---

## 4. ラウンド累積のタイムリミット

### 単位の定義

**`BattleEngineV3` の `round`（ラウンド）。** `state.currentTurn`（ゲーム本体のターン）とは別概念。

1ラウンド ＝ 場に出ている生存ユニット全員が1回ずつ行動する単位（`startRound()` → `nextActor()` が SP 昇順で1体ずつ返す → `markActed()` → null になるまで）。

### 仕様

- 挑戦開始時に**残ラウンド = 40**（仮置き定数）
- 各戦闘が終わるたび、その戦闘で消費した `round` を残ラウンドから**減算**
- 残ラウンドが **0 を下回った時点で強制帰還**
- 画面に残ラウンド数を表示する

`battleMode: 'dungeon'` は1戦闘あたり `maxRounds = Infinity`（無制限）。**この挙動は変更しない。** 制限は挑戦セッション層でかける。

### 実装上の注意

戦闘終了時に消費ラウンド数を知る必要がある。`BattleEngineV3` の `this.round` を戦闘終了時に読み出して渡すこと。`BattleScene` の `onBattleEnd` コールバック（`:1306`）が受け皿になる。

---

## 5. 休憩（新規）

**次の戦闘に進まず、残りラウンドを消費して回復する選択肢。** 現行実装に無い。

| 項目 | 値 |
|------|-----|
| 消費 | 1ラウンド |
| 回復 | 挑戦メンバー**全員**の `soldiers` +50 / `charHp` +5 |

- `soldiers` は `maxSoldiers` を超えない
- `charHp` は `charMaxHp` を超えない
- 残ラウンドが 0 なら休憩できない

UI は `DungeonScene` の `phase: 'next_or_escape'`（`:223`）に選択肢を足すのが素直。**当面は暫定UIでよい。**

---

## 6. やらないこと

- **クラファン挑戦の仕様**（ミーム閾値300・全額没収・ゴール判定・報酬）→ **C-3**
- **浅層探索の報酬**（ミーム＋好感度、`rewardItem` 停止）→ C-3
- 敵編成の対称化・SP上限成長 → **C-1**
- `dungeons.json` のコンテンツ追加（フロア・敵の新規作成）→ 対象外。既存の龍泉洞1件で動けばよい
- UI の作り込み → 当面は暫定でよい

**指示範囲外のコード・コメントを変更しないこと。**

---

## 7. 注意

- `bases.json` から `dungeonId` を削除する際、参照が残っていないか `grep -rn "dungeonId" src/` で確認すること
- 投機的実装・不要な抽象化をしないこと
- 不明点があれば勝手に判断せず確認すること
