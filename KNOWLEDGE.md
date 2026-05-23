# KNOWLEDGE.md — kiritan_r テックリード引き継ぎ

> 最終更新: 2026-05-23（内政実装 Phase A+B 完了: PartyScene強化・PartnerWidget・TheaterScene）
> このファイルのみ参照。旧ドキュメントはすべて docs/archive/ に格納済み。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| **本番リポジトリ** | `/Users/kamatashintarou/MCP_Learning/kiritan_r/` |
| スタック | React 18 + Vite（Node v22必須） |
| 起動 | `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run dev` → **localhost:5174** |
| QA環境 | `http://localhost:5174/?qa=battlefull` |
| エディタ | `node tools/editor.cjs` → **localhost:3001**（移植中） |
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
  editor.cjs              ← Nodeエディタサーバ（移植中・localhost:3001）
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

## 6. シーン実装状況（2026-05-22）

| シーン | ファイル | GameContext | 実データ | 備考 |
|--------|---------|------------|---------|------|
| title | TitleScene.jsx | ✅ | ✅ | |
| map | MapScene.jsx | ✅ | ✅ | |
| base_menu | BaseMenuScene.jsx | ✅ | ✅ | |
| formation | FormationScene.jsx | ✅ | ✅ | Design v4マージ済み（V3.2） |
| battle | BattleScene.jsx | ✅ | ✅ | Design v4マージ済み（V3.2） |
| enemy_turn | EnemyTurnScene.jsx | ✅ | ✅ | |
| characters | PartyScene.jsx | ✅ | ✅ | |
| items | ItemsScene.jsx | ✅ | ✅ | inventory+items.jsonベース実装済み（2026-05-22） |
| research | ResearchScene.jsx | ✅ | ✅ | |
| save | SaveScene.jsx | ✅ | ✅ | |
| game_end | GameEndScene.jsx | ✅ | ✅ | |
| adv | ADVScene.jsx | ✅ | ✅ | EventEngine接続済み（2026-05-20） |
| theater | TheaterScene.jsx | ✅ | ✅ | Phase B実装済み（2026-05-23）。events.jsonフラット版からロード |
| dungeon | DungeonScene.jsx | ⬜ | 🔴 | dungeons.json未読込 |
| new_game_plus | NewGamePlusScene.jsx | ⬜ | 🔴 | DEMO_FACTIONSハードコード |

---

## 7. GameContext API

```js
const {
  currentTurn, factions, bases, characters, inventory, buildings,
  playerFaction, playerBases, income, availableChars,
  gamePhase,       // 'playing' | 'victory' | 'defeat'
  // Phase A 追加フィールド
  actionPoints, maxActionPoints,  // 行動力（ターン終了で全回復）
  researchQueue,   // null | { id, turnsRemaining } — 研究中はnon-null
  upgradeUnlocks,  // string[] — アンロック済みコマンドID
  secretaryId,     // null | charId
  systems,         // { buildingSystem, itemSystem, skills, items }
  legionAI,
  setStartDialogHandler,  // App.jsx起動時に登録する
  actions: {
    startNewGame(),
    runEnemyPhase(),           // attackQueue を返す（NEXT_TURN dispatch なし）
    runEnemyPhaseForFaction(factionId),
    startPlayerTurn(),         // NEXT_TURN dispatch + player_turn イベント
    beforeAttack(baseId, factionId),
    battleEnd({ usedCharIds, deadCharIds, deadMobIds, unitResults,
                conquered, defenderBaseId, winnerFactionId }),
    doResearch(id),            // 即時研究（旧・後方互換維持）
    startResearch(id),         // Phase A: ターン制研究キューに登録
    setActionPoints(n),        // 行動力を直接セット
    setSecretary(charId),
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

**戻り値: `{ scenario, cast, bg, location }`**（オブジェクト）

- `type:'text'` → `type:'dialog'`, `characterId` → `speaker`, `expr:'normal'`固定
- `type:'narration'` → そのまま
- `type:'end'` → そのまま
- `type:'choice'` → 現時点でスキップ
- `cast` はpositionごとに先着1キャラをMapで集計してオブジェクト配列で返す
- **setupステップは出力しない**（BUG-012修正済み）

### 8-3. startDialog 登録（App.jsx）

```js
useEffect(() => {
  game.setStartDialogHandler((script, onComplete) => {
    const { scenario, cast, bg, location } = convertEventScript(script);
    navigate('adv', { scenario, cast, bg, location, returnTo: 'map', _onComplete: onComplete });
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

## 10. 防衛フロー（App.jsx state machine）

```
handleNextTurn()
  → runEnemyPhase()           // LegionAI内政 + EventEngine:enemy_turn
  → 勢力ごとループ:
      runEnemyPhaseForFaction(faction.id)  // before_faction_turn
      EnemyTurnScene カットイン（Promise）
      startDefenseQueue(factionQueue)      // defenseFlow state machine 起動
        → defenseFlow: { queue, index, phase:'adv' }
  → startPlayerTurn()         // 全防衛完了後: NEXT_TURN dispatch + player_turn
  → navigate('map')

defenseFlow.phase:
  'adv'       → MapScene上の PartnerWidget が防衛プロンプトモーダルを表示
                秘書設定済みなら立ち絵＋台詞バブル付き
                「防衛する」→ onDefend() → phase:'formation'
                「放棄する」→ PartnerWidget内部の確認ダイアログ
                              「はい」→ onAbandon() → battleEnd呼出（放棄処理）
                              「いいえ」→ モーダルに戻る（App.jsx state変化なし）
                ※ abandon_confirm フェーズは廃止。確認はPartnerWidget内部stateで完結
  'formation' → FormationScene（防衛編成）
  'battle'    → BattleScene（防衛戦闘）

advanceDefenseQueue(phase):
  phase=defeat/victory → defenseFlowResolveRef('ended') → handleNextTurnがreturn
  nextIndex >= queue.length → defenseFlowResolveRef('ok') → startPlayerTurn
  それ以外 → index++ → phase:'adv'

App.jsx から MapScene へ渡す defensePrompt:
  defenseFlow.phase === 'adv' のとき useMemo で構築
  { defenderBase, attackerFaction, estimatedSoldiers }
  phase !== 'adv' のとき null → PartnerWidget はモーダルを非表示
```

---

## 11. Design連携状況（2026-05-19更新）

### Design出力先
`/Users/kamatashintarou/MCP_Learning/kiritan_r_designs/`

### 現在の状況
- Design v4: 納品済み・レビュー通過・マージ完了・移植漏れ修正完了（V3.2）
- 次回Designタスク: 戦闘アニメーション演出の詳細詰め（v5相当。dungeon実装後）
- バージョン管理ルール: 更新ごとにv番号++、ZIPで納品

---

## 12. エンジン単体QA結果

E01〜E16 全完了（2026-05-19）。E17・E18はIntegration QAで確認。
詳細は `docs/archive/ARCHIVED_QA_BUG_20260519.md` 参照。

---

## 13. 解決済みバグ

BUG-001〜008 全解消済み。詳細は `docs/archive/ARCHIVED_QA_BUG_20260519.md` 参照。

| BUG | 内容 | 解消日 |
|-----|------|--------|
| BUG-009 | 勝利/敗北バナークリック不可（onBattleEnd即onComplete・pointerEvents問題） | 2026-05-19 |
| BUG-010 | 防衛戦FormationScene→BattleScene遷移不可（zoom修正で解消） | 2026-05-19 |
| BUG-011 | UnitCard flexShrink競合警告 | 2026-05-19 |
| M-01〜D-07 | ワールドマップ全10件（ターン数・順序・首都陥落・宣戦等） | 2026-05-22 |
| BUG-012 | ADV StrictMode: setup useEffectが2回実行され最初のセリフをスキップ → setup概念廃止、cast/bg/locationをpropsで渡す方式に変更 | 2026-05-23 |
| BUG-013 | tab-map.js `_appendBgSection`: `container.insertBefore(section, btnRow)` が NotFoundError → `wrap.appendChild(section)` に修正。エディタの戦闘背景画像セクションが表示されない問題を解消 | 2026-05-23 |

---

## 14. BattleEngineV3 仕様要点

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

## 15. デザイントークン

`src/shared/tokens.js` から import。直書き禁止。

```js
PK='#c4427a', PK2='#9e2d5f', AC='#b87010', AC2='#d4a044',
TEAL='#1a8a96', TX='#1c1020', TXD='rgba(28,16,32,.55)',
TXF='rgba(28,16,32,.24)', BR='rgba(0,0,0,.08)'
glass(extra={})
```

---

## 16. セーブキー

`kiritan_save_{slot}`（slot: 1|2|3）。SAVE_VERSION = **8**（Phase A で 7→8 更新）。

旧セーブ（v7以前）は後方互換: actionPoints=5, researchQueue=null, upgradeUnlocks=['sp_refill','sp_max_up'], secretaryId=null がデフォルト補填される。

---

## 17. docs 運用ルール

```
docs/prompts/   ← 作業中のCodeへの引き継ぎプロンプト（MD）
docs/archive/   ← 完了済みプロンプト・旧ドキュメント
```

Codeへの引き継ぎプロンプトは `docs/prompts/PROMPT_<名前>.md` に置く。
作業完了後は `docs/archive/` に移動する。

---

## 18. 残タスク

### 次フェーズ（優先順）
1. ~~ADVScene EventEngine接続~~ → 完了（2026-05-20）
2. ~~ワールドマップ QA・バグ修正~~ → 完了（2026-05-22、M-01〜D-07全件）
3. **エディタ移植** — バグ修正・機能補完完了（2026-05-23）
3b. ~~**内政実装 Phase A**~~ → 完了（2026-05-23）
   - GameContext: actionPoints/maxActionPoints/researchQueue/upgradeUnlocks/secretaryId 追加
   - NEXT_TURN: 行動力全回復 + 研究キューターンカウント消化・完了時フラグ付与
   - applyEffectToState: actionPointsBonus 追加
   - TopBar: ⚡行動力表示（val=null で自動非表示）
   - ResearchScene: ターン制UI（研究中バナー・グレーアウト・期間表示・onStartResearch）
   - facilities.json: turns / prerequisites / unlocks フィールド追加
   - SAVE_VERSION 7→8
3c. ~~**内政実装 Phase B**~~ → 完了（2026-05-23）
   - PartyScene: UPGRADE_COMMANDS定義・秘書ボタン・強化コマンドUI（SP補充/SP最大値増加）
   - PartnerWidget: 秘書立ち絵・idleバブル・防衛プロンプトモーダル（防衛/放棄/確認）
   - 防衛フロー: ADVSceneオーバーレイ廃止 → PartnerWidget統合（phase:'adv'継続・描画委譲）
   - TheaterScene: type:'theater'イベントのリスト表示・条件評価・ADV起動
   - BottomBarに「劇場」ボタン追加
   - secretary_lines.json / events.json（フラット版） 新規作成
   - **内政パート実装完了**
   - エディタ保存ボタン修正: 完了
   - セリフタブ削除: 完了
   - イベントタブスクロール修正（Bug1）: 完了
   - 一括登録ページ `/bulk-input.html` 追加（Bug2）: 完了
   - `defeatedChar` 条件追加（Task B）: 完了
   - `actionPointsBonus` エフェクト追加（Task C）: 完了
   - choice の `effectsKey` フィールド（Task D）: 完了
   - イベントリストに `type` 表示（Task F-1）: 完了
   - `_buildEditor` に `type` 入力フィールド（Task F-2）: 完了
   - `base_visit` / `base_defense` 発火調査（Task E）: 完了→結果は §18 参照
4. ~~**戦闘背景画像システム**~~ → 完了（2026-05-23、エディタ登録・自動採番・bgField/bgCastle 2フィールド・BattleScene動的背景・BUG-013修正済み）
4b. ~~**一括登録 拡張**~~ → 完了（2026-05-23、5タブ化：キャラ/特技/特技アサイン/迷宮/迷宮アサイン、battleCapacity列追加、editor.css適用）
5. **dungeon** — DungeonScene.jsx への GameContext・dungeons.json 接続
6. **new_game_plus** — DEMO_FACTIONS をハードコードから実データに切り替え
7. **gallery / settings / credits** — 実装
8. characters.json の strategyRate / kana 実値調整（ゲームバランス確認後）
9. 野戦/市街戦の判定ロジック → 内政ゲームデザイン残タスク
10. **Electron化（デスクトップアプリ配布）**

### 戦闘まわり
- 戦闘アニメーション演出の詳細詰め（Design v5相当）→ dungeon実装後

### base_visit / base_defense 発火調査（2026-05-23）

- `base_visit`: EventEngine.js のコメント（§8-1）に記載あり。`processTrigger(ws, 'base_visit', ...)` の呼び出しは**どこにも存在しない**。BaseMenuScene.jsx の「訪問」ボタンは `navigate('adv', ...)` に直接遷移しており、イベントエンジンを経由していない。
- `base_defense`: EventEngine.js のコメントに「startDefense() 直前」と記載あり。App.jsx の `startDefenseQueue()` 内にも**呼び出しなし**。`ev_first_attack_from_natto.json` など JSON側で trigger に `base_defense` を指定しているイベントは存在するが、発火されない状態。
- **対応方針**: 将来的に `base_visit` は BaseMenuScene.jsx の「訪問」ボタン処理に、`base_defense` は App.jsx の defenseFlow 開始直前に `processTrigger` を追加する必要がある。

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
