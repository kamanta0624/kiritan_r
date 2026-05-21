# KNOWLEDGE.md — kiritan_r テックリード引き継ぎ

> 最終更新: 2026-05-20（ADVScene × EventEngine 接続完了・エディタ移植着手）
> このファイルのみ参照。旧ドキュメントはすべて docs/archive/ に格納済み。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| **本番リポジトリ** | `/Users/kamatashintarou/MCP_Learning/kiritan_r/` |
| スタック | React 18 + Vite（Node v22必須） |
| 起動 | `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run dev` → **localhost:5174** |
| QA環境 | `http://localhost:5174/?qa=battlefull` |
| エディタ | `node tools/editor.js` → **localhost:3001**（移植中） |
| 旧リポジトリ | `/Users/kamatashintarou/MCP_Learning/kiritan/`（Phaser版、参照専用） |

**kiritan_r が本番。kiritan（Phaser版）は実装の参照・比較のみに使うこと。**

---

## 2. プロセス管理

```bash
lsof -i :5173 -i :5174 -i :5175 | grep LISTEN
```

5174のみ起動させる。5173・5175以降はkillすること。

---

## 3. ディレクトリ構成

```
src/
  App.jsx                 ← シーンルーター・防衛キュー制御
  context/GameContext.jsx ← 全ゲーム状態（WorldMapScene相当）
  scenes/                 ← 全シーン（.jsx）
  shared/
    tokens.js             ← デザイントークン（PK/AC/TEAL等）+ デモデータ
    SharedUI.jsx          ← TopBar / BottomBar / NavButton
  game/
    data/                 ← JSON（bases/characters/factions/skills等）
    systems/              ← BattleEngineV3 / BattleAI / BuildingSystem / LegionAI / EventEngine
    utils/BattleBonus.js
tools/
  editor.js               ← Nodeエディタサーバ（移植中・localhost:3001）
  editor-ui.html
  editor.css
  editor-modules/         ← タブ別モジュール
docs/
  Game.html               ← デザインプロトタイプ（ClaudeDesign参照用）
  archive/                ← 旧ドキュメント・完了済みタスク
```

---

## 4. 担当分担

| 役割 | 責務 |
|------|------|
| ClaudeDesign | UIデザイン・JSX生成のみ。ロジック接続は範囲外 |
| ClaudeCode | GameContext接続・バグ修正・シーン統合 |

**ClaudeDesignの納品物は必ずレビュー後にマージ。ロジック品質を期待しない。**

旧バージョン（kiritan/Phaser版）との矛盾は全て旧バージョンが優先。
実装できない部分はDesignへ差し戻し、UIの軽微な修正はCodeに依頼。

---

## 5. 用語定義（誤用厳禁）

| 用語 | 正しい意味 |
|------|-----------|
| **参戦** | SP（soldiers）が battleCapacity を下回ったとき将軍本体がダメージを受ける可能性が生じる状態。**戦闘への参加キャラ選出とは別概念。** |
| SP | ミーム（兵士）。`soldiers` フィールド |
| 戦闘域 | `battleCapacity`。この値未満のSPで参戦状態になる |
| ミーム（通貨） | リソース単位。`treasury` フィールド |

---

## 6. シーン実装状況（2026-05-20）

| シーン | ファイル | GameContext | 実データ | 備考 |
|--------|---------|------------|---------|------|
| title | TitleScene.jsx | ✅ | ✅ | |
| map | MapScene.jsx | ✅ | ✅ | |
| base_menu | BaseMenuScene.jsx | ✅ | ✅ | |
| formation | FormationScene.jsx | ✅ | ✅ | Design v4マージ済み（V3.2） |
| battle | BattleScene.jsx | ✅ | ✅ | Design v4マージ済み（V3.2） |
| enemy_turn | EnemyTurnScene.jsx | ✅ | ✅ | |
| characters | PartyScene.jsx | ✅ | ✅ | |
| items | ItemsScene.jsx | ✅ | ⚠️ | inventory空時DEMO_ITEMSフォールバック |
| research | ResearchScene.jsx | ✅ | ✅ | |
| save | SaveScene.jsx | ✅ | ✅ | |
| game_end | GameEndScene.jsx | ✅ | ✅ | |
| adv | ADVScene.jsx | ✅ | ✅ | EventEngine接続済み（2026-05-20） |
| dungeon | DungeonScene.jsx | ⬜ | 🔴 | dungeons.json未読込 |
| new_game_plus | NewGamePlusScene.jsx | ⬜ | 🔴 | DEMO_FACTIONSハードコード |

---

## 7. GameContext API

```js
const {
  currentTurn, factions, bases, characters, inventory, buildings,
  playerFaction, playerBases, income, availableChars,
  gamePhase,   // 'playing' | 'victory' | 'defeat'
  systems,     // { buildingSystem, itemSystem, skills, items }
  legionAI,
  setStartDialogHandler,  // App.jsx起動時に登録する
  actions: {
    startNewGame(), nextTurn(),
    onPlayerTurnStart(), beforeAttack(baseId, factionId),
    battleEnd({ usedCharIds, deadCharIds, deadMobIds, unitResults,
                conquered, defenderBaseId, winnerFactionId }),
    doResearch(id),
    declareWar(targetFactionId), isAtWar(targetFactionId),
    updateChar(char), setFlag(key, val, withTimestamp?),
    setTreasury(factionId, amount),
    addItem(item), removeItem(instanceId),
    conquerBase(baseId, winnerFactionId),
    save(slot), load(slot), getSaveSlots(),
  },
  buildBattleUnit,   // BattleEngineV3.buildUnit
  checkVictory(),
} = useGame();
```

---

## 8. ADVScene 仕様（2026-05-20 実装完了）

### 8-1. EventEngine → ADVScene フロー

```
EventEngine.processTrigger()
  → ws.startDialog(expandedScript, onComplete)
    → startDialogRef.current(script, onComplete)  // App.jsx で登録
      → convertEventScript(script)               // ADVScene.jsx named export
        → navigate('adv', { scenario, returnTo:'map', _onComplete: onComplete })
          → ADVScene onExit: _onComplete?.() → navigate('map')
```

### 8-2. convertEventScript(script, { bg, location })

`ADVScene.jsx` から named export。EventEngineの展開済みスクリプト（`_expandConversation`適用後）をADVScene scenarioに変換する。

- `type:'text'` → `type:'dialog'`, `characterId` → `speaker`, `expr:'normal'`固定
- `type:'narration'` → そのまま
- `type:'end'` → そのまま
- `type:'choice'` → 現時点でスキップ
- 先頭に `type:'setup'` を自動生成（castはpositionごとに先着1キャラ）

### 8-3. startDialog 登録（App.jsx）

```js
useEffect(() => {
  game.setStartDialogHandler((script, onComplete) => {
    const scenario = convertEventScript(script);
    navigate('adv', { scenario, returnTo: 'map', _onComplete: onComplete });
  });
}, []);
```

### 8-4. game_start トリガー

`startNewGame()` が async化済み。`dispatch({ type:'START_NEW_GAME' })` 後に `EventEngine.processTrigger(ws, 'game_start', {})` を発火。

**注意**: dispatch直後のbuildWsAdapterはSTART_NEW_GAME適用前のstateを参照する可能性あり。現行イベントは `conditions:[]` のため実害なし。条件付きgame_startを追加する場合は要注意。

---

## 9. 戦闘フロー — 旧バージョン正仕様（2026-05-15 実装・QA完了）

### 9-1. 正しいフロー

```
[キャラ選出] FormationScene
  - 全キャラを単一リストで表示（roleによる制約なし）
  - 選択可能条件: !usedThisTurn && soldiers>0 && !(penaltyTurns>0)
  - クリック順に追加。最大4体
  - 選択順 1・2体目 → front / 3・4体目 → rear 自動決定
  - 1体以上で出撃可能

[ラウンド開始]
  engine.startRound()  ← round++、全unit._actedThisRound=false

[行動ループ]
  engine.nextActor()  ← soldiers最小の未行動・生存・未撤退ユニット
  プレイヤー → UI選択 → 確定 → engine.executeAction() 即時実行
  AI → selectAction() → selectTarget() → executeAction() 即時実行
  engine.markActed(unit) → checkGameOver() → 次へ

[ラウンド終了]
  applyRetreatRule() → checkGameOver() → checkRoundLimit()
  → startRound()（次ラウンド）※画面遷移なし

[戦闘終了]
  char.soldiers / char.charHp 書き戻し、penaltyTurns=2
  BResolveSceneは存在しない
```

### 9-2. 実装済み差異

全解消済み。詳細は `docs/archive/ARCHIVED_QA_BUG_20260519.md` 参照。

### 9-3. BResolveScene（廃止・削除完了）

V3.1で削除済み。詳細は `docs/archive/ARCHIVED_QA_BUG_20260519.md` 参照。

---

## 10. Design連携状況（2026-05-19更新）

### Design出力先
`/Users/kamatashintarou/MCP_Learning/kiritan_r_designs/`

### 現在の状況
- Design v4: 納品済み・レビュー通過・マージ完了・移植漏れ修正完了（V3.2）
- 次回Designタスク: 戦闘アニメーション演出の詳細詰め（v5相当。dungeon実装後）
- バージョン管理ルール: 更新ごとにv番号++、ZIPで納品

---

## 11. エンジン単体QA結果

E01〜E16 全完了（2026-05-19）。E17・E18はIntegration QAで確認。
詳細は `docs/archive/ARCHIVED_QA_BUG_20260519.md` 参照。

---

## 12. 解決済みバグ

BUG-001〜008 全解消済み。詳細は `docs/archive/ARCHIVED_QA_BUG_20260519.md` 参照。

| BUG | 内容 | 解消日 |
|-----|------|--------|
| BUG-009 | 勝利/敗北バナークリック不可（onBattleEnd即onComplete・pointerEvents問題） | 2026-05-19 |
| BUG-010 | 防衛戦FormationScene→BattleScene遷移不可（zoom修正で解消） | 2026-05-19 |
| BUG-011 | UnitCard flexShrink競合警告 | 2026-05-19 |

---

## 13. BattleEngineV3 仕様要点

- `charHp <= 0` で戦闘不能（soldiers=0でも将軍HP残存なら継続）
- 同時HP0 → プレイヤー側HP=1に補正
- `battleMode`: `normal`（5R）/ `dungeon`（無制限）/ `duel`（決闘: 無制限・撤退不可）/ `event`
- `strategyMult.winnerChar`: 作戦成功側の最高strategyRateキャラ（null=互角）
- `executeAction()` は async。BattleFlow側も await で受ける
- 特技 `trigger`: `instant`（即時）/ `charge`（集中→必殺）
- `allowRetreat`: dungeon/duel以外はtrue
- **V3.2** `_onExchangeResult(atk, def, {atkMem, atkChr, defMem, defChr, N, Nr})`: 交換結果コールバック。`_resolveExchange`末尾で発火。BattleScene側の `animState` を更新してアニメーションオーバーレイを駆動する。

```js
BattleEngineV3.buildUnit(char, sideType, index)
// index < 2 → 'front' / index >= 2 → 'rear'

// ターゲットプール
// ranged/song → 敵全体
// 近接 → 敵前衛。前衛0なら全体

// 後衛近接のoptions
// !isFront && !isRanged && !isSong → ['defend','retreat'] のみ
```

---

## 14. デザイントークン

`src/shared/tokens.js` から import。直書き禁止。

```js
PK='#c4427a', PK2='#9e2d5f', AC='#b87010', AC2='#d4a044',
TEAL='#1a8a96', TX='#1c1020', TXD='rgba(28,16,32,.55)',
TXF='rgba(28,16,32,.24)', BR='rgba(0,0,0,.08)'
glass(extra={})
```

---

## 15. セーブキー

`kiritan_save_{slot}`（slot: 1|2|3）

---

## 16. docs 運用ルール

```
docs/prompts/   ← 作業中のCodeへの引き継ぎプロンプト（MD）
docs/archive/   ← 完了済みプロンプト・旧ドキュメント
```

Codeへの引き継ぎプロンプトは `docs/prompts/PROMPT_<名前>.md` に置く。
作業完了後は `docs/archive/` に移動する。

---

## 17. 残タスク

### ワールドマップ QA・バグ修正（着手中・2026-05-20）
- ~~`docs/prompts/PROMPT_worldmap_qa.md`~~ — 完了（QAページ作成済み・`?qa=worldmap`）
- ~~`docs/prompts/PROMPT_worldmap_impl.md`~~ — 完了（防衛撤退・勢力表示4値・エリア区分）
- `docs/prompts/PROMPT_worldmap_bugfix.md` — **未着手**。旧kiritanとの差異比較で判明した全10件のバグ修正
  - M-01: ターン数増えない（NEXT_TURN dispatch タイミング逆）
  - M-02: 敵ターン順序逆（attackQueue が state 反映前に onComplete）
  - M-03: 首都陥落でゲームオーバーにならない（`_originalFactionId` 未設定）
  - D-02: `before_faction_turn` EventEngine トリガーなし
  - D-03: 攻撃勝利時に `declareWar` 未呼び出し
  - D-04: `conqueredThisTurn` が BATTLE_END で true にならない
  - D-05: 防衛放棄時の勝敗判定が stale state
  - D-06: 防衛編成で攻撃側キャラ情報が空（mob の factionId null）
  - D-07: `player_turn` 発火タイミングずれ（M-02修正で解消見込み）

### 戦闘まわり
- 戦闘アニメーション演出の詳細詰め（Design v5相当）→ dungeon実装後

### 次フェーズ（優先順）
1. ~~ADVScene EventEngine接続~~ → 完了（2026-05-20）
2. **ワールドマップ QA・バグ修正** — 上記参照（着手中）
3. **エディタ移植** — 引き継ぎプロンプト作成済み・未着手
4. **dungeon** — DungeonScene.jsx への GameContext・dungeons.json 接続
5. **new_game_plus** — DEMO_FACTIONS をハードコードから実データに切り替え
6. **gallery / settings / credits** — 実装
7. characters.json の strategyRate / kana 実値調整（ゲームバランス確認後）
8. 野戦/市街戦の判定ロジック → 内政ゲームデザイン残タスク
9. **Electron化（デスクトップアプリ配布）** → マスターアップ後に着手。React + Viteのままで適用可能。minWidth/minHeightでウィンドウ最小サイズを強制できる。ブラウザでの最小サイズ崩れはそれまで許容。

### エディタ移植（引き継ぎプロンプト作成済み・未着手）
- 移植先: `tools/` ディレクトリ（新規）
- 旧kiritan `tools/` から全タブ移植
- イベント保存: フラット配列→idベースで個別JSONファイル保存・`_index.json`更新（案B確定）
- データパス変更: `src/data/` → `src/game/data/`、`assets/` → `public/`
- キャラフィールド追加: `kana` / `recoveryRate`

### 内政ゲームデザイン残タスク（別途設計が必要）
- 都市防衛ボーナス・市街戦による影響の数値設計
- 野戦/市街戦の判定条件（攻撃側の兵力・道路状況等）
- 拠点ごとの画像（targetNode.image）設定
