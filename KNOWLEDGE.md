# KNOWLEDGE.md — kiritan_r テックリード引き継ぎ

> 最終更新: 2026-05-30（戦闘バグ調査: BUG-A/C修正完了、BUG-B/D真因確定・実装引き継ぎ中。§13/§14-1/§18 更新）
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
| theater | TheaterScene.jsx | ✅ | ✅ | Phase 5統合済み（2026-06-01）。getAvailableTheaterEvents で候補取得・events.json廃止 |
| dungeon | DungeonScene.jsx | ✅ | ✅ | dungeons.json接続・5フェーズ実装済み（2026-05-24） |
| new_game_plus | NewGamePlusScene.jsx | ⬜ | 🔴 | DEMO_FACTIONSハードコード |

---

## 7. GameContext API

```js
const {
  currentTurn, factions, bases, characters, inventory, buildings,
  playerFaction, playerBases, income, availableChars,
  // availableChars は soldiers=0 を含む。soldiers=0 のキャラは通常戦闘の編成では実質戦力外だが、ダンジョン探索には参加できる。
  dungeonProgress,         // { [dungeonId]: { clearedFloors, isFullyCleared } }
  dungeonExploredThisTurn, // bool — ターン終了で false にリセット
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
    dungeonFloorClear({ dungeonId, clearedFloors, isFullyCleared, rewardItem }),
    dungeonExplored(),   // dungeonExploredThisTurn=true
    dungeonDefeat(charId), // charHp=1, soldiers=0, penaltyTurns=2
  },
  buildBattleUnit,   // BattleEngineV3.buildUnit
  checkVictory(),
} = useGame();
```

---

## 8. ADVScene 仕様（2026-05-20 実装 / 2026-06-01 契約刷新）

ADVScene の契約は **`{ script, effects, onExit }`** に刷新済み（旧 `scenario/cast/bg/location/returnTo/_onComplete/_onChoice` は廃止）。
- **script**: 呼び出し元の生スクリプト（`conversation/text/narration/choice/cutin/end`）。`bg`/`location`/`transparent` は `script.meta` から読む。conversation 展開・char_NNN→c-ID 変換・cast 生成は **ADV 内部**で行う。
- **effects**: イベント effects 形式 `{ default:[...], <key>:[...] }`。**end 到達時に `default` を `useGame().actions.applyEffects` で適用**。**choice の effects は選択時に即時適用**。
- **onExit**: 終了通知のみ。戻り先制御・直列化（次イベント起動）は呼び出し元が onExit に閉じる。**ADV は戻り先を知らない**。

### 8-1. EventEngine → ADVScene フロー

```
EventEngine._runEvent()
  → ws.startDialog({ script: ev.script, effects: ev.effects }) → Promise
    → startDialogRef.current(script, effects, resolve)         // App.jsx で登録
      → navigate('adv', { script, effects, onExit })           // onExit = () => { navigate('map'); resolve(); }
        → ADVScene: 内部で scenario/cast 構築・表示
          → end 到達 → applyEffects(effects.default) → onExit()  // navigate('map') + resolve で次イベントへ直列化
```

choice を持つイベント: 選択時に ADV が `applyEffects(choice.effects)` を即時適用し、`choice.next`（原 script index）→ scenario index へ分岐。end でさらに `effects.default` を適用。

### 8-2. ADV 内部変換（buildScenario / buildCast）

`convertEventScript`（旧 named export）は廃止。代わりに ADVScene 内部の `buildScenario(script)` / `buildCast(script)` が変換する。

- `conversation` → 各 line を `dialog` に展開（**ADV 側で展開**。EventEngine は `_expandConversation` を持たない）
- `text` → `dialog`（`characterId`→`speaker`、`expr` は step 値 or `'normal'`）
- `narration` / `cutin` / `end` → そのまま（cutin は `subtext` も保持）
- `dialog` → 内部形式パススルー（DEMO_SCENARIO 等）
- `choice` → `{ speaker, text, choices:[{label, next, effects}] }`
- `buildScenario` は `stepIndexMap`（原 index → scenario index）も返し、`choice.next` の分岐解決に使う
- `buildCast` は position ごとに先着1キャラを集計（CHARS に存在するキャラのみ）

### 8-3. startDialog 登録（App.jsx）

```js
useEffect(() => {
  game.setStartDialogHandler((script, effects, onComplete) => {
    navigate('adv', {
      script, effects,
      onExit: () => { navigate('map'); onComplete?.(); },
    });
  });
}, []);
```

`buildWsAdapter().startDialog` は `({ script, effects }) => Promise` を返し、ダイアログが閉じる（onExit→resolve）まで解決しない。これにより `_runEvent` の await が保たれ、同一trigger 内の複数イベントが**直列表示**される（navigate('map') による unmount/remount で ADV 内部 state もリセット）。

**他の呼び出し元**:
- **TheaterScene（Phase 5統合）**: App theater ケースが `game.actions.getTheaterEvents()` で候補表示。`onStartTheater` → `runTheaterEvent(eventId)`（出現回数加算し EventDef 返却）→ 行動力消費 → `navigate('adv', { script: ev.script, effects: ev.effects, onExit:()=>navigate('theater') })`。`script.meta.location` にイベント名を付与。`_runEvent` は経由しない（戻り先を呼び出し元が制御する Phase 2 方針との整合・候補は getTheaterEvents で評価済のため二重評価なし）。theater イベントは `events/theater/*.json`（`trigger:'theater'`、表示用に `title`/`description`/`category`/`cost` を併載、`repeatable` は `maxOccurrences:-1`）。
- **DungeonScene**: `getEventById(eventId)` で EventDef 取得 → `script`+`effects` 直接（現状 floor に eventId 設定なしで実質未使用）。
- **script を持たないイベント**: EventEngine が `ws.applyEffects(default)` を直接適用する。

`events.json`（フラット配列）は廃止。全イベントは `_index.json` + `events/**` の統一ソース（`getEventById` / `getAvailableTheaterEvents` / `_loadAllEvents`）から読む。

### 8-4. game_start トリガー

`startNewGame()` が async化済み。`dispatch({ type:'START_NEW_GAME' })` 後に `EventEngine.processTrigger(ws, 'game_start', {})` を発火。

**注意**: dispatch直後のbuildWsAdapterはSTART_NEW_GAME適用前のstateを参照する可能性あり。現行イベントは `conditions:[]` のため実害なし。条件付きgame_startを追加する場合は要注意。

### 8-5. 複数発火と条件評価の鮮度（Phase 4 / 2026-05-31）

`processTrigger` の player_turn 以外も `eligible` 全件を順次 await 発火する（旧仕様の `eligible[0]` 単発を変更）。エフェクト適用は `GameContext.actions.applyEffects` に一本化（script を持つイベントは ADV 内部から、持たないイベントは EventEngine から呼ぶ。2026-06-01 契約刷新で choice/end effects も ADV 側へ移管）。

**既知の制約**: `eligible` はループ**前に1回だけ** `_filterEligible` で算出する。ループ内で条件を再評価しない。よって同一trigger内の後続イベントの条件評価は、先行イベントのエフェクト結果（flag/treasury等）を**反映しない**（ループ前スナップショット固定）。

- 現状: 後続条件が先行イベントの結果に依存する設計のイベントは存在しない → 実害なし
- 顕在化条件: 「同一trigger・同一発火で、イベントAが立てたflagをイベントBの条件が参照する」設計を追加したとき。この場合 B は古いsnapshotで評価され意図通り発火しない
- 対策（必要時）: ループ内で都度 `buildWsAdapter()` 再取得 + `_filterEligible` 再評価。ただし `stateRef` のdispatch反映タイミング（非同期）も併せて要検証

エフェクト適用自体はws鮮度に非依存（`applyEffects` は `stateRef.current` を読まず dispatch/ref のみ使用）。本制約は**条件評価の鮮度のみ**に関わる。

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

#### 撤退仕様（重要・変更禁止）

- **撤退（retreat）を選択したユニットが出た時点で、その戦闘は即終了する**（`_doRetreat` → `_finish`）。これは仕様。攻撃側ユニットが撤退 → 攻撃側敗北、防衛側ユニットが撤退 → 攻撃側勝利。
- 「撤退で戦闘終了」を不具合とみなして個別離脱に変える提案（旧A案系）は**仕様違反**。過去に複数回繰り返された誤り。`_doRetreat` の `_finish` を消してはならない。
- バグは「終了する」ことではなく「AIが交戦前に安易に撤退を選ぶ」こと。原因は下記。
  - 軍団の `retreatRule`（char_dead 等）が**戦闘エンジンに未結線**。`applyRetreatRule` は現状 BattleScene から呼び出し0件（BUG-Aで唯一の呼び出し＝ハードコード'loss_50'を削除して以降オーファン。上記フローの「applyRetreatRule() → …」は現状未実行＝記述が古い）。
  - `BattleAI.selectAction` は rear-melee に options=['defend','retreat'] を与え攻撃肢なし→ランダムで撤退を選ぶ。`selectAction`/`selectTarget` は V3 で「ランダム固定」（コマンド・ターゲットとも乱択）。
- あるべき修正は retreatRule の結線とAI撤退選択の抑制（B案）。`_doRetreat` の終了挙動は維持。
- **2026-05-31 残1 クローズ（P2）**: retreatRule を選択肢ゲートとして結線。
  - `LegionAI.getDefendersWithRule(factionId, base, chars, mode)` が `{ chars, retreatRule }` を返す（採用軍団の `getRetreatRule` 解決込み）。
  - `App.jsx`: 攻撃戦（`case 'battle'`）は AI=守備側で `mode='defense'`、防衛戦（defenseFlow）は AI=攻撃側で `item.retreatRule`(onAttack) を `enemyRetreatRule` prop で渡す。
  - `BattleScene._calcOptions(unit, allowRetreat, retreatRule, eng)`: `never`→撤退不可、`hp_any`/未指定→常に可、`char_dead`/`loss_*`→敵サイドに `charHp<=0` が出たら可（簡易判定。loss比率の厳密化は後続）。プレイヤー側はUI選択のため不使用。

#### モブ生成（現在値 ≤ 最大値）

- **2026-05-31 P1**: `BuildingSystem.createMobInstance` は `maxSoldiers`/`charMaxHp` を `vary()` で1回だけ確定し、`soldiers=Math.min(vary(soldiers), maxSol)`・`charHp=charMaxHp=maxHp`（生成時満タン）。soldiers と maxSoldiers / charHp と charMaxHp を各々別 `vary()` で振っていたため現在値>最大値（22/21・5/4）が発生していた。`runDomestic` の補充も同関数経由のため同時に解消。

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
| BUG-014 | エディタ研究タブで研究ノード0件表示 → `editor.cjs` の再起動が必要。古いプロセスが残存すると `/api/data` に `facilities` キーが含まれない | 2026-05-24 |
| BUG-015 | 撤退時に敵SP半減（`BattleScene.jsx` `onRoundEnd` の `applyRetreatRule('loss_50', enemySide)` が仕様外発火。KNOWLEDGE §9-1に撤退時SP減少の記述なし）→ 該当1行削除 | 2026-05-30 |
| BUG-016 | SPダメージが理論値と乖離（`normalizeChar` L54 が `c.charAttack`（将軍本体攻撃力）を `soldierAtk`（SP攻撃力）として採用）→ `atk: c.soldierAtk ?? c.charAttack ?? 10` に解決順を修正。characters.jsonが敵として渡る全戦闘に影響 | 2026-05-30 |

> 戦闘バグ調査の全経緯・真因・修正方針は `docs/prompts/PROMPT_battle_bugs_v3.md` 参照。BUG-A/C（=BUG-015/016）修正完了。BUG-B/Dは真因確定・実装はCODE引き継ぎ中（下記 §14-1）。

---

## 14. BattleEngineV3 仕様要点

- `charHp <= 0` で戦闘不能（soldiers=0でも将軍HP残存なら継続）
- 同時HP0 → プレイヤー側HP=1に補正
- `battleMode`: `normal`（5R）/ `dungeon`（無制限）/ `duel`（決闘: 無制限・撤退不可）/ `event`
- `strategyMult.winnerChar`: 作戦成功側の最高strategyRateキャラ（null=互角）
- `executeAction()` は async。BattleFlow側も await で受ける
- 特技 `trigger`: `instant`（即時）/ `charge`（集中→必殺）
- `allowRetreat`: dungeon/duel以外はtrue
- **V3.2** `_onExchangeResult(atk, def, result)`: 交換結果コールバック。`_resolveExchange`末尾で発火。BattleScene側の `animState` を更新してアニメーションオーバーレイを駆動する。
  - `result` フィールド（量と命中数を1対1で分離。**N = SP命中 + 将軍命中 が常に成立**）:
    - `atkMem/atkChr/defMem/defChr`: SP/HP の**ダメージ量**（兵士＋将軍本人分マージ済み）。DamageBurst/BottomPortrait で表示。
    - `N/Nr`: 攻撃側/反撃側の総突撃数 `min(soldiers, battleCapacity)`。
    - `atkToMeme/atkToChar`（+`def*`）: 兵士突撃の**命中数内訳**（SP命中＋将軍命中＝N）。overlay の SP/本体ストリーム count に使う。
    - `atkSelfMemeHits/atkSelfCharHits`（+`def*`）: 将軍本人攻撃の命中数（兵士分と別系統）。overlay の「将軍」ストリーム。
    - `atk/defSolBefore`・`atk/defHpBefore`: 交換前の値（overlay の差分アニメ用）。
  - **反撃**: 成立条件は「攻撃側が近接(`action==='attack'`)」のみ。守備側タイプ不問。反撃は `_calcOneSide(def, atk, _, asCounter=true)` で直接攻撃扱い（間接化/mult低下を抑止）。

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

## 14-1. 戦闘デバッグ知見（2026-05-30・実機ブラウザ観測で確定）

調査経緯・修正方針は `docs/archive/PROMPT_battle_bugs_v3.md` / `docs/archive/PROMPT_battle_followup_v3.md`（完了後アーカイブ済）。以下は再利用すべき確定事実。

> **2026-05-31 完了**: 実機観測6バグ（followup v3）修正済。
> - BUG-1 反撃門番除去（守備側タイプ不問・反撃は直接攻撃扱い `asCounter`）
> - BUG-2 防衛戦 `mode='defense'`/sideType/`playerWins=!wins` 対応（R5タイムアウト＝防衛成功＝プレイヤー勝利）
> - BUG-3 交換キュー化（`animQueueRef`）で先行overlayスキップ解消
> - BUG-4/5/6 `_onExchangeResult` 契約拡張（toMeme/toChar/selfHits）→ overlayがSP命中・将軍命中・将軍本人攻撃を分離表示
> - ハードニング: enemyUnits の charHp/charAttack/attackCount 実値反映、色トークン tokens.js import、`_calcOptions(unit, allowRetreat)` 結線
>
> **2026-05-31 完了（followup v4）**: 実機2バグ（`docs/archive/PROMPT_battle_followup_v4.md`）。
> - P1 モブ現在値>最大値（`createMobInstance` で最大値1回確定・現在値クランプ。§9-1 参照）
> - P2 軍団 retreatRule 結線＝v2残1 本実装（`getDefendersWithRule`→`enemyRetreatRule` prop→`_calcOptions` ゲート。§9-1 参照）

### 確定した真因（コード+データ+実機の三点一致）

- **BUG-B 敵防衛者の漏出**: `LegionAI.getDefenders`（L130-146）は、対象拠点を `defendBases` に持つ軍団が無い場合、フォールバックで `allCharacters.filter(c => c.factionId===X && c.soldiers>0)` を返す。これが **地理・軍団を無視して全勢力員を防衛側に投入**する。郡山(base_021, faction_red)は防衛軍団未設定のため、三陸/いわき担当の中部つるぎ等が郡山防衛に湧く。同一ユニットが複数拠点を同時防衛する副症状も同根。
  - 修正方針: 全勢力員フォールバックを廃止し、勢力ごとの「防衛専用モブ軍団（`isDefenseReserve:true`）」参照に置換。全勢力に reserve 軍団を legions.json へ追加。詳細は prompt §A。
- **BUG-D overlayの値固着**: `BattleScene.jsx` `BattleAnimOverlay` はSP/HPを `useState(初期値)`（マウント時1回）で保持し、描画側 `{animState && <BattleAnimOverlay .../>}` に `key` が無い。連続交換でanimStateがnullを挟まず差し替わると同一インスタンスが再利用され、**名前は `anim` から更新されるがSP/HPは前交換の値で固着**。結果、生存中の敵が前交換の死亡値0/0で表示される。`streams`/`attackLine` の `useMemo(...,[])` も同様にstale。
  - 修正方針: 交換ごと変わる `key`（`animState._seq` 連番推奨）で強制再マウント。詳細は prompt §B。

### enemyUnits のハードコード（BUG-B被害を拡大）

`BattleScene.jsx` enemyUnits 生成は `charHp:10`/`charMaxHp:10`/`attackCount:8` を固定し、実キャラの charHp（例: 中部つるぎ=9）を上書きする。脆弱ユニットが初回交換で即殲滅され「戦闘開始直後に0/0」の症状を増幅。要ハードニング。

### 未解明の異常（保留・要 syncDisplay 精読）

- 敵生存カウント「ENEMY UNITS 0/N」が、敵複数生存(charHp>0)でも 0 表示。
- side panel の敵HP表示がエンジン実値と乖離（ログ「しのび 0/10 戦闘不能」時にパネルは 10/10）。

### デバッグ手法: 実機ブラウザ観測

静的解析だけでは経路の取り違え（攻撃戦↔防衛戦）に陥りやすい。Claude in Chrome で稼働中の戦闘を読み取り専用観測（スクショ＋DOM/ACTION LOG）すると、(a) どのシーン/経路か、(b) どのユニットがどちら側か、(c) overlay表示とエンジン実状態の乖離、を即断できる。今回 CODE の静的解析2回の誤経路を、実機4フレームで真因2件まで確定。**仮説の判別に限定して使い、原因断定は必ずコード/データ根拠で行う**こと。観測は事実取得であり推論ではない。

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

`kiritan_save_{slot}`（slot: 1|2|3）。SAVE_VERSION = **9**（研究システム全面改修で 8→9 更新）。

旧セーブ（v7以前）は後方互換: actionPoints=5, researchQueue=null, upgradeUnlocks=['sp_refill','sp_max_up'], secretaryId=null がデフォルト補填される。
旧セーブ（v8以前）は後方互換: purchasedUpgrades=[] をデフォルト補填される。

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
   - **イベントタブUI改善（v6: `.ev-*` CSSクラス集約・3ペインレイアウト刷新）**: 完了（2026-05-25）
4. ~~**戦闘背景画像システム**~~ → 完了（2026-05-23、エディタ登録・自動採番・bgField/bgCastle 2フィールド・BattleScene動的背景・BUG-013修正済み）
4b. ~~**一括登録 拡張**~~ → 完了（2026-05-23、5タブ化：キャラ/特技/特技アサイン/迷宮/迷宮アサイン、battleCapacity列追加、editor.css適用）
5. ~~**dungeon**~~ → 完了（2026-05-24、DungeonScene.jsx 5フェーズ実装・GameContext接続・dungeons.json接続）
6. **new_game_plus** — DEMO_FACTIONS をハードコードから実データに切り替え
7. **gallery / settings / credits** — 実装
8. characters.json の strategyRate / kana 実値調整（ゲームバランス確認後）
9. 野戦/市街戦の判定ロジック → 内政ゲームデザイン残タスク
10. **Electron化（デスクトップアプリ配布）**

### 戦闘まわり
- ~~**BUG-A/B/C/D**~~ → 完了。~~**実機6バグ（followup v3: BUG-1〜6）+ ハードニング**~~ → 完了（2026-05-31、§14-1 参照）。
- **保留調査**: 敵生存カウント「0/N」誤表示、side panel 敵HP乖離（§14-1）。`syncDisplay` 精読で切り分け。
- 戦闘エンジンのマジック定数集約（残ハードニング）。
- 戦闘アニメーション演出の詳細詰め（Design v5相当）→ dungeon実装後

### base_visit / base_defense 発火調査（2026-05-23）

- `base_visit`: EventEngine.js のコメント（§8-1）に記載あり。`processTrigger(ws, 'base_visit', ...)` の呼び出しは**どこにも存在しない**。BaseMenuScene.jsx の「訪問」ボタンは `navigate('adv', ...)` に直接遷移しており、イベントエンジンを経由していない。
- ~~`base_defense`: App.jsx の `startDefenseQueue()` 内に呼び出しなし~~ → **Phase 3 (2026-05-31) で接続済**。
- **base_visit**: 訪問UI未実装のため当面スキップ（ディレクター判断待ち）。

#### trigger接続状況（Phase 3 完了・2026-05-31）
- 共通基盤 `game.actions.fireTrigger(trigger, ctx)` を GameContext に新設（`buildWsAdapter` 経由）。
- 接続済trigger: `game_start` / `player_turn` / `enemy_turn` / `before_faction_turn` / `base_attack` / `base_conquered`（既存5+1）に加え、Phase 3 で **`base_defense` / `battle_start` / `battle_end` / `char_defeated`** を接続。
  - `base_defense`: `startDefenseQueue()` のキュー先頭処理前。ctx に `attackerFactionId`（`attackerFaction` 条件が参照・必須）と `baseId`。
  - `battle_start`: BattleScene `onBattleStart` prop（初期化 `startRound` 直前で1回）。ctx に `playerCharIds` / `baseId`。※対応イベントJSONは現状未存在（将来用）。
  - `battle_end`: `battleEnd()` 内で制圧有無に関わらず発火。ctx に `conquered` / `defenderBaseId` / `winnerFactionId`。※対応イベントJSON未存在。
  - `char_defeated`: `battleEnd()` で `result.defeatedEnemyCharIds`（敵側・非モブ将軍）各IDに直列発火。ctx キーは `defeatedCharId`（`defeatedChar` 条件と厳密一致）。
- `theater`: processTrigger は介さない。TheaterScene が `game.actions.getTheaterEvents()`（= `getAvailableTheaterEvents`）で候補表示。実行は `runTheaterEvent(eventId)`（出現回数加算）→ App が `ev.script`/`ev.effects` を `navigate('adv', { script, effects, onExit:()=>navigate('theater') })` で起動（Phase 5統合・2026-06-01）。
- 未接続: `base_visit`（UI未実装）。

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

### 内政ゲームデザイン残タスク（別途設計が必要）
- 都市防衛ボーナス・市街戦による影響の数値設計
- 野戦/市街戦の判定条件（攻撃側の兵力・道路状況等）
- 拠点ごとの画像（targetNode.image）設定

---

## 19. キャラクリ（周回要素）— 設計未着手

**概要:**
- 全キャラに個別の「キャラクリ解除条件」が設定されている
- 条件を満たしてエンディングを迎えると、そのキャラとのエピローグ会話が挿入されキャラクリ解除
- ニューゲームでキャラクリ解除状況に応じたボーナス・特殊ルート解禁

**現状:**
- NewGamePlusScene.jsx: UIのみ実装済み。勢力選択画面（DEMO_FACTIONSダミー3件）
- キャラクリ解除条件・エピローグ会話・ボーナス内容・特殊ルートの詳細は全て未設計
- 実装はdungeon・new_game_plus接続より後

**設計が必要な項目（全て未定）:**
- 各キャラのキャラクリ解除条件（特定フラグ達成 + エンディング到達）
- エピローグ会話の内容・ADVScene連携フロー
- キャラクリ解除状態の永続化（localStorage別キー等）
- ニューゲーム開始時ボーナスの種類・数値
- 特殊ルートの内容
