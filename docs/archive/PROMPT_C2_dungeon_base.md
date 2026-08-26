# PROMPT_C2_dungeon_base — ダンジョン基盤改修（Phase C-2）

対象: ClaudeCode
参照必須: `docs/DESIGN_CROWDFUNDING.md`（仕様SSOT）§1 / §1-2 / §2-7 / §5
関連: `KNOWLEDGE.md` §5（用語）§7（GameContext API）

C-1 とは独立。並行可。**C-3 は本プロンプトに依存する。**

**用語**: キャラの兵力は**ミーム**（`soldiers` / 上限 `maxSoldiers`）。旧称 SP は廃止。**フィールド名は変更しない。**

---

## 0. 成功基準

達成するまでループして直すこと。

1. `npm run build` が成功する
2. 拠点メニューから「迷宮」コマンドが消えている
3. **BottomBar の「ダンジョン」から入れる**
4. 入った先で**クラファン / 浅層探索**を選べる（中身は C-3 で実装。本プロンプトでは選択できればよい）
5. **最大4名を選んで挑戦できる**（現状は単騎）
6. 画面に**残ラウンド数が表示され、戦闘のたびに減る**
7. 1戦目7ラウンド・2戦目5ラウンドなら残ラウンドが 40 → 33 → 28 と減る
8. 戦闘の合間に**「進む」「休む」の2択**が出る
9. **「休む」で全員のHPが全回復し、残ラウンドが5減る**
10. 残ラウンドが0を下回った時点で強制帰還する
11. 旧セーブ（v10）をロードしてもエラーが出ない

---

## 1. 「ダンジョン」の再定義

**ダンジョン ＝ クラファン挑戦と浅層探索の総称。** 拠点付属の迷宮（盛岡＝龍泉洞）という概念を廃止する。

### 撤去するもの

| 対象 | 箇所 |
|------|------|
| 「迷宮 DUNGEON」コマンド | `src/scenes/BaseMenuScene.jsx:23` |
| `hasDungeon` prop | `src/App.jsx:351` |
| `dest === 'dungeon'` 分岐 | `src/App.jsx:355-356` |
| `dungeonId` フィールド | `src/game/data/bases.json`（`base_012` のみ値あり。**フィールドごと削除**） |
| `baseId` | `src/game/data/dungeons.json` |

削除後に `grep -rn "dungeonId\|hasDungeon" src/` で参照残存がないことを確認すること。

### 残すもの（流用）

`DungeonScene.jsx` のフロー、`dungeons.json` のフロア・敵定義、`state.dungeonProgress` / `dungeonExploredThisTurn`、`actions.dungeonFloorClear` / `dungeonExplored` / `dungeonDefeat`。

---

## 2. 入口を BottomBar へ

`src/shared/SharedUI.jsx` の `BottomBar`（`:84-86` 付近に既存 NavButton）に**「ダンジョン」を1つ追加**する。

遷移先で **クラファン / 浅層探索** を選ぶ。想定する画面遷移:

```
BottomBar「ダンジョン」
  → クラファン / 浅層探索 の選択          ← 本プロンプトで実装
    → （クラファンなら）7種のゴール選択    ← C-3
      → 参加キャラ選択（最大4名）          ← 本プロンプトで実装
        → 挑戦開始 → 戦闘ループ ⇄ 進む／休む
```

`App.jsx:619` の `case 'dungeon'` は `sceneParams.baseNode?.dungeonId` を引いている（`:621`）。**ダンジョンIDを直接渡す形に変える。**

**UI は当面暫定でよい**（将来まとめて直す方針）。

---

## 3. 複数キャラ挑戦

現状は単騎（`App.jsx:35` の `dungeonFlow = { dungeonId, explorerCharId, floor, baseNode }`）。

**最大4名を選べるようにする。** 編成の考え方は通常戦闘と同じ（1・2人目＝メインキャスト、3・4人目＝サブキャスト）。

- `dungeonFlow` の `explorerCharId`（単数）を配列へ
- `DungeonScene` の `phase: 'select'` を複数選択に対応
- `actions.dungeonDefeat(charId)` は単騎前提（`charHp=1` / `soldiers=0` / `penaltyTurns=2`）。**複数キャラ対応へ拡張する**
- 戦闘への受け渡しは既存の `formation` 形式（`{ front1, front2, rear1, rear2 }`）に合わせる

**「ダンジョン探索は `soldiers = 0` でも可」という既存仕様**（`KNOWLEDGE.md` §7 の `availableChars` 注記）は**維持し、変更しないこと**。

参加条件（クラファンの `maxSoldiers >= 必要ミーム`）は **C-3 の担当**。本プロンプトでは人数選択の器を作るだけでよい。

---

## 4. ラウンド累積のタイムリミット

### 単位の定義

**`BattleEngineV3` の `round`（ラウンド）。** `state.currentTurn`（ゲーム本体のターン）とは別概念。

1ラウンド ＝ 場に出ている生存ユニット全員が1回ずつ行動する単位（`startRound()` → `nextActor()` がミーム昇順で1体ずつ返す → `markActed()` → null になるまで）。

### 仕様

- 挑戦開始時の残ラウンド: **クラファン 40 / 浅層探索 20**（仮置き定数。1箇所にまとめること）
- 各戦闘終了時、その戦闘で消費した `round` を残ラウンドから**減算**
- **0 を下回った時点で強制帰還**
- 画面に残ラウンド数を表示

`battleMode: 'dungeon'` の1戦闘あたりラウンド無制限（`maxRounds = Infinity`）は**維持**。制限は挑戦セッション層でかける。

### 実装上の注意

戦闘終了時に消費ラウンド数を知る必要がある。`BattleEngineV3` の `this.round` を戦闘終了時に読み出して渡すこと。`BattleScene` の `onBattleEnd` コールバック（`:1306`）が受け皿になる。

---

## 5. 「進む」「休む」の2択

**戦闘ループの合間に選択肢を出す。**

| 選択 | 効果 |
|------|------|
| 進む | 次の戦闘へ |
| **休む** | **全員のHP（`charHp`）を `charMaxHp` まで全回復。残ラウンドを5消費** |

- **ミームは回復しない。** クラファン挑戦中は `maxSoldiers = 0` のため回復しても意味がない（C-3 で実装）
- 残ラウンドが5未満なら「休む」を選べない

既存 `DungeonScene` の `phase: 'next_or_escape'`（`:223`）に組み込むのが素直。**UI は暫定でよい。**

---

## 6. セーブ

**挑戦中のセーブは不可**（セーブはワールドマップのみ）。

そのため挑戦セッションの状態（残ラウンド・参加キャラ・現在フロア）は **`App.jsx` のローカル state で持てばよい**。`GameContext.state` に載せる必要はなく、`SAVE_VERSION` の繰り上げも**不要**。

---

## 7. やらないこと

- **クラファンの仕様**（必要ミーム・ミーム上限没収・ゴール・報酬）→ **C-3**
- **浅層探索の報酬**（ミーム＋好感度、`rewardItem` 停止）→ **C-3**
- **敵プールの作り替え・敵の抽選・対称化** → **C-3**
- `_calcPool` 撤去・ミーム上限成長 → **C-1**
- `dungeons.json` のコンテンツ追加 → 対象外。既存の龍泉洞1件で動けばよい
- UI の作り込み → 当面は暫定でよい

**指示範囲外のコード・コメントを変更しないこと。**

---

## 8. 注意

- 投機的実装・不要な抽象化をしないこと
- 不明点があれば勝手に判断せず確認すること
