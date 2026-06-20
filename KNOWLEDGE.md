# KNOWLEDGE.md — kiritan_r テックリード引き継ぎ

> 最終更新: 2026-06-10（肥大化整理・実装状況と同期。完了済みの詳細は docs/archive/ へ集約）
> このファイルのみ参照。履歴・完了済みの詳細は docs/archive/ にある。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| **本番リポジトリ** | `/Users/kamatashintarou/MCP_Learning/kiritan_r/` |
| スタック | React 19 + Vite（Node v22必須） |
| 起動 | `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && npm run dev` → **localhost:5173** |
| QA環境 | `http://localhost:5173/?qa=battlefull` |
| エディタ | `npm run editor`（= `node tools/editor.cjs`）→ **localhost:3001** |
| 旧リポジトリ | `/Users/kamatashintarou/MCP_Learning/kiritan/`（Phaser版、参照専用） |

**kiritan_r が本番。kiritan（Phaser版）は実装の参照・比較のみ。矛盾時は旧バージョンが正仕様。**
`npm run dev` は素の `vite`（ポート指定なし）＝デフォルト **5173**。

---

## 2. プロセス管理

```bash
lsof -i :5173 -i :5174 -i :5175 | grep LISTEN
```

5173のみ起動。5174・5175以降はkill。

---

## 3. ディレクトリ構成

```
src/
  App.jsx                 ← シーンルーター・防衛キュー制御
  context/GameContext.jsx ← 全ゲーム状態（WorldMapScene相当）
  scenes/                 ← 全シーン（.jsx）+ QA用シーン
  shared/
    tokens.js             ← デザイントークン（PK/AC/TEAL等）+ デモデータ
    SharedUI.jsx          ← TopBar / BottomBar / NavButton
  game/
    data/                 ← JSON（bases/characters/factions/skills/legions/dungeons/items等）
    systems/              ← BattleEngineV3 / BattleAI / BuildingSystem / LegionAI / EventEngine / ItemSystem / SaveSystem
    utils/BattleBonus.js
tools/
  editor.cjs              ← Nodeエディタサーバ（localhost:3001）
  editor-ui.html / editor.css / bulk-input.html
  editor-modules/         ← タブ別モジュール
docs/
  prompts/                ← 作業中のCode引き継ぎプロンプト（内容は本ファイルで追跡しない。ls で確認）
  archive/                ← 完了済みプロンプト・旧ドキュメント（Game.html / DESIGN_DOMESTIC.md 等）
  IMAGE_TASKS.md / image_asset_audit.md / assets/  ← 画像タスク管理
```

---

## 4. 担当分担

| 役割 | 責務 |
|------|------|
| ClaudeDesign | UIデザイン・JSX生成のみ。ロジック接続は範囲外 |
| ClaudeCode | GameContext接続・バグ修正・シーン統合 |
| Chat | 調査・診断・アーキ確認・引き継ぎプロンプト作成・本ドキュメント保守 |
| 人間（オーナー） | QA1次担当・アーキ判断・エージェント間調整 |

**Designの納品物は必ずレビュー後にマージ。ロジック品質を期待しない。** 実装不能はDesignへ差し戻し、UI軽微修正はCodeに依頼。

---

## 5. 用語定義（誤用厳禁）

| 用語 | 正しい意味 |
|------|-----------|
| **参戦** | SP（soldiers）が battleCapacity を下回り将軍本体がダメージを受ける可能性が生じる状態。**戦闘への参加キャラ選出とは別概念。** |
| SP | ミーム（兵士）。`soldiers` フィールド |
| 戦闘域 | `battleCapacity`。この値未満のSPで参戦状態 |
| ミーム（通貨） | リソース単位。`treasury` フィールド |

---

## 6. シーン実装状況

| シーン | ファイル | GameContext | 実データ | 備考 |
|--------|---------|------------|---------|------|
| title | TitleScene.jsx | ✅ | ✅ | |
| map | MapScene.jsx | ✅ | ✅ | PartnerWidget（秘書立ち絵・防衛プロンプト）統合 |
| base_menu | BaseMenuScene.jsx | ✅ | ✅ | |
| formation | FormationScene.jsx | ✅ | ✅ | Design v4（V3.2） |
| battle | BattleScene.jsx | ✅ | ✅ | Design v4（V3.2）+ アニメoverlay |
| enemy_turn | EnemyTurnScene.jsx | ✅ | ✅ | |
| characters | PartyScene.jsx | ✅ | ⚠️ | 勢力絞込・SP表示・全画面詳細・強化コマンド。BUG-06/07（非実在フィールド参照）未解消・portrait未対応 |
| items | ItemsScene.jsx | ✅ | ✅ | inventory+items.json |
| research | ResearchScene.jsx | ✅ | ✅ | ターン制研究キュー |
| save | SaveScene.jsx | ✅ | ✅ | |
| game_end | GameEndScene.jsx | ✅ | ✅ | |
| adv | ADVScene.jsx | ✅ | ✅ | EventEngine接続・契約 `{script,effects,onExit}` |
| theater | TheaterScene.jsx | ✅ | ✅ | Phase 5統合・events/theater/*.json |
| dungeon | DungeonScene.jsx | ✅ | ✅ | dungeons.json接続・5フェーズ |
| new_game_plus | NewGamePlusScene.jsx | ⬜ | 🔴 | DEMO_FACTIONSハードコード（残タスク） |

未実装: gallery / settings / credits。
凡例: ✅=接続・実データ整合済 / ⚠️=接続済だが実データ整合に未解消項目あり / ⬜=未接続 / 🔴=モックデータ。

---

## 7. GameContext API

```js
const {
  currentTurn, factions, bases, characters, inventory, buildings,
  playerFaction, playerBases, income, availableChars,
  // availableChars は soldiers=0 を含む。soldiers=0 は通常戦闘編成では戦力外、ダンジョン探索は可。
  dungeonProgress,         // { [dungeonId]: { clearedFloors, isFullyCleared } }
  dungeonExploredThisTurn, // bool — ターン終了で false
  gamePhase,               // 'playing' | 'victory' | 'defeat'
  actionPoints, maxActionPoints,  // 行動力（ターン終了で全回復）
  researchQueue,           // null | { id, turnsRemaining }
  upgradeUnlocks,          // string[] — アンロック済みコマンドID
  secretaryId,             // null | charId
  systems,                 // { buildingSystem, itemSystem, skills, items }
  legionAI,
  setStartDialogHandler,   // App.jsx起動時に登録
  actions: {
    startNewGame(),                       // async。START_NEW_GAME → game_start 発火 → startPlayerTurn（player_turn 発火・ターン1入場）
    runEnemyPhase(), runEnemyPhaseForFaction(factionId),
    startPlayerTurn(),                    // NEXT_TURN dispatch + player_turn
    beforeAttack(baseId, factionId),
    battleEnd({ usedCharIds, deadCharIds, deadMobIds, unitResults,
                conquered, defenderBaseId, winnerFactionId }),
    doResearch(id), startResearch(id),    // 即時 / ターン制キュー
    setActionPoints(n), setSecretary(charId),
    declareWar(targetFactionId), isAtWar(targetFactionId),
    updateChar(char), setFlag(key, val, withTimestamp?),
    setTreasury(factionId, amount),
    addItem(item), removeItem(instanceId),
    conquerBase(baseId, winnerFactionId),
    save(slot), load(slot), getSaveSlots(),
    dungeonFloorClear({ dungeonId, clearedFloors, isFullyCleared, rewardItem }),
    dungeonExplored(), dungeonDefeat(charId),   // charHp=1, soldiers=0, penaltyTurns=2
    applyEffects(effectsList),            // エフェクト適用一本化（dispatch/refのみ・stateRef非依存）
    fireTrigger(trigger, ctx),            // EventEngine trigger発火の共通基盤
    getTheaterEvents(), runTheaterEvent(eventId),
  },
  buildBattleUnit,         // BattleEngineV3.buildUnit
  checkVictory(),
} = useGame();
```

---

## 8. ADVScene 仕様

契約は **`{ script, effects, onExit }`**（旧 `scenario/cast/bg/location/returnTo/_onComplete/_onChoice` は廃止）。
- **script**: 呼び出し元の生スクリプト（`conversation/text/narration/choice/cutin/end`）。`bg`/`location`/`transparent` は `script.meta`。conversation展開・char_NNN→c-ID変換・cast生成は **ADV内部**（`buildScenario`/`buildCast`）。
- **effects**: `{ default:[...], <key>:[...] }`。**end到達時に `default` を `applyEffects` で適用**。**choice の effects は選択時に即時適用**。
- **onExit**: 終了通知のみ。戻り先制御・直列化は呼び出し元が onExit に閉じる。**ADVは戻り先を知らない**。

### 8-1. フロー

```
EventEngine._runEvent()
  → ws.startDialog({ script, effects }) → Promise
    → startDialogRef.current(script, effects, resolve)   // App.jsx 登録
      → navigate('adv', { script, effects, onExit })     // onExit = () => { navigate('map'); resolve(); }
        → ADVScene 内部で scenario/cast 構築・表示
          → end → applyEffects(effects.default) → onExit()  // 次イベントへ直列化
```

choice 持ちは選択時に `applyEffects(choice.effects)` 即時適用＋`choice.next`（原script index→scenario index）分岐。end でさらに `default` 適用。`buildScenario` は `stepIndexMap` を返し分岐解決に使う。

### 8-2. 強制再マウント（2026-06-02）

各 startDialog/theater 起動時に `dialogSeqRef` をインクリメントした `dialogId` を付与、`<ADVScene key={sceneParams.dialogId ?? 'adv'}>` で描画。key変化で unmount→remount し `idx`/`finishedRef`/`history` をリセット。同一 scene='adv' で逐次2件目が来てもフリーズしない。

### 8-2b. 透過背景MAP（2026-06-16）

`renderScene` の `case 'adv'` は MapScene を `pointerEvents:'none'` ラッパで背景に残し、その上に透過 ADVScene を重ねて描画する（`navigate('adv', { transparent })` 既定 true）。bg画像未設定でも背後にMAPが透けて見える。ADVScene 側は `transparent`（prop → `meta.transparent` → false）で背景黒 `#0a0610`・BG描画・dim overlay をスキップし、DialogBox を全幅下部バー表示にする。背景MapScene には `onReady` 等の副作用コールバックを渡さない（背景用途・二重副作用防止）。非透過にしたい呼び出しは `navigate('adv', { transparent:false, ... })`。

### 8-3. 呼び出し元

- **EventEngine**: `processTrigger` が `eligible` 全件を順次 await 発火。script無しイベントは EventEngine が `applyEffects(default)` 直接適用。
- **TheaterScene（Phase 5）**: `getTheaterEvents()`（=`getAvailableTheaterEvents`）で候補表示 → `runTheaterEvent(eventId)`（出現回数加算）→ 行動力消費 → `navigate('adv', {…, onExit:()=>navigate('theater')})`。`_runEvent` を経由しない。theaterイベントは `events/theater/*.json`（`trigger:'theater'`、`maxOccurrences:-1` で repeatable）。
- **DungeonScene**: `getEventById(eventId)` → script+effects 直接（現状 floor に eventId 未設定で実質未使用）。

`events.json`（フラット配列）は廃止。全イベントは `_index.json` + `events/**`（`getEventById`/`getAvailableTheaterEvents`/`_loadAllEvents`）から読む。

### 8-4. trigger 接続状況

接続済: `game_start` / `player_turn` / `enemy_turn` / `before_faction_turn` / `base_attack` / `base_conquered` / `base_defense` / `battle_start` / `battle_end` / `char_defeated`。共通基盤は `actions.fireTrigger(trigger, ctx)`。
未接続: `base_visit`（訪問UI未実装・ディレクター判断待ち）。
- **ターン入場は全ターン `player_turn` 単一経路**（2026-06-07統一）。`startNewGame` が `game_start`（生涯1回・`ev_000_opening` のみ）発火後に `startPlayerTurn` を呼び、`currentTurn` 0→1 で `player_turn` を発火（ターン1も非例外）。ターン1専用イベントは `trigger:"player_turn"`/`conditions:[{type:"turn",op:"eq",value:1}]`（例 `ev_turn1_status`）。`game_start` 残存は `ev_000_opening` のみ。`createInitialState.currentTurn=0`。NGP直navigate・`?qa=`専用シーンは startNewGame 非経由で `currentTurn=0` を読む（NGP集約時に解消予定）。
- `battle_start`/`battle_end` は対応イベントJSON未存在（将来用）。

### 8-5. 既知の制約（条件評価の鮮度）

`eligible` はループ**前に1回だけ** `_filterEligible` で算出。同一trigger内の後続イベント条件は先行イベントのエフェクト結果（flag/treasury）を**反映しない**（スナップショット固定）。現状そう設計したイベントは無く実害なし。顕在化したら都度 `buildWsAdapter()` 再取得＋`_filterEligible` 再評価で対応。エフェクト適用自体はws鮮度に非依存。

---

## 9. 戦闘フロー — 旧バージョン正仕様（QA完了）

### 9-1. 正しいフロー

```
[キャラ選出] FormationScene
  - 全キャラ単一リスト表示（role制約なし）
  - 選択可能条件: !usedThisTurn && soldiers>0 && !(penaltyTurns>0)
  - クリック順に追加、最大4体。1・2体目→front / 3・4体目→rear。1体以上で出撃可

[ラウンド] engine.startRound() → round++、全unit._actedThisRound=false
[行動ループ] engine.nextActor()（soldiers最小の未行動・生存・未撤退）
  プレイヤー → UI選択 → engine.executeAction() 即時 / AI → selectAction→selectTarget→executeAction
  engine.markActed → checkGameOver → 次
[ラウンド終了] applyRetreatRule → checkGameOver → checkRoundLimit → startRound（画面遷移なし）
[戦闘終了] char.soldiers/charHp 書き戻し、penaltyTurns=2。BResolveScene は存在しない
```

### 9-2. 撤退仕様（重要・変更禁止）

- **撤退（retreat）を選択したユニットが出た時点でその戦闘は即終了**（`_doRetreat`→`_finish`）。これは仕様。攻撃側撤退→攻撃側敗北、防衛側撤退→攻撃側勝利。
- 「撤退で戦闘終了」を不具合とみなし個別離脱に変える提案（旧A案系）は**仕様違反**。`_doRetreat` の `_finish` を消すな。
- 撤退ルール結線済（P2）: `LegionAI.getDefendersWithRule(factionId, base, chars, mode)` が `{ chars, retreatRule }` を返す。App.jsx が攻撃戦=AI守備側 `mode='defense'`、防衛戦=AI攻撃側で `enemyRetreatRule` prop を渡す。`BattleScene._calcOptions(unit, allowRetreat, retreatRule, eng)`: `never`→不可 / `hp_any`・未指定→常時可 / `char_dead`・`loss_*`→敵側に `charHp<=0` 出現で可（簡易判定。loss比率厳密化は後続）。プレイヤー側はUI選択のため不使用。

### 9-3. モブ生成（現在値 ≤ 最大値）

`BuildingSystem.createMobInstance` は `maxSoldiers`/`charMaxHp` を `vary()` で1回確定し `soldiers=Math.min(vary(soldiers), maxSol)`・`charHp=charMaxHp=maxHp`（生成時満タン）。`runDomestic` の補充も同関数経由。

---

## 10. 防衛フロー（App.jsx state machine）

```
handleNextTurn()
  → runEnemyPhase()                       // LegionAI内政 + EventEngine:enemy_turn
  → 勢力ごと: runEnemyPhaseForFaction → EnemyTurnScene カットイン → startDefenseQueue
  → startPlayerTurn()（全防衛完了後）→ navigate('map')

defenseFlow.phase:
  'adv'       → MapScene上の PartnerWidget が防衛プロンプトモーダル表示
                秘書設定済なら立ち絵＋台詞バブル付き
                「防衛する」→ onDefend → phase:'formation'
                「放棄する」→ PartnerWidget内部の確認ダイアログ（はい→onAbandon→battleEnd / いいえ→戻る）
                ※ abandon_confirm フェーズは廃止。確認は PartnerWidget 内部stateで完結
  'formation' → FormationScene（防衛編成）
  'battle'    → BattleScene（防衛戦闘）

advanceDefenseQueue(phase):
  defeat/victory → defenseFlowResolveRef('ended')
  nextIndex >= queue.length → ('ok') → startPlayerTurn
  それ以外 → index++ → phase:'adv'

App→MapScene の defensePrompt: phase==='adv' のとき useMemo 構築
  { defenderBase, attackerFaction, estimatedSoldiers }。phase!=='adv' は null（モーダル非表示）
```

---

## 11. BattleEngineV3 仕様要点

- `charHp <= 0` で戦闘不能（soldiers=0でも将軍HP残存なら継続）。同時HP0→プレイヤー側HP=1補正。
- `battleMode`: `normal`（5R）/ `dungeon`（無制限）/ `duel`（無制限・撤退不可）/ `event`
- `strategyMult.winnerChar`: 作戦成功側の最高strategyRateキャラ（null=互角）
- `executeAction()` は async。BattleFlow側も await。
- 特技 `trigger`: `instant`（即時）/ `charge`（集中→必殺）
- `allowRetreat`: dungeon/duel以外 true
- `buildUnit(char, sideType, index)`: index<2→front / >=2→rear
- ターゲットプール: ranged/song→敵全体 / 近接→敵前衛（前衛0なら全体）
- 後衛近接 options: `!isFront && !isRanged && !isSong → ['defend','retreat']` のみ

### `_onExchangeResult(atk, def, result)`（V3.2）

交換結果コールバック。`_resolveExchange` 末尾で発火。BattleScene の `animState` を更新しアニメoverlayを駆動。**N = SP命中 + 将軍命中 が常に成立**。
- `atkMem/atkChr/defMem/defChr`: SP/HP ダメージ量（兵士＋将軍マージ済）
- `N/Nr`: 攻撃側/反撃側 総突撃数 `min(soldiers, battleCapacity)`
- `atkToMeme/atkToChar`（+`def*`）: 兵士突撃の命中数内訳（SP命中＋将軍命中＝N）
- `atkSelfMemeHits/atkSelfCharHits`（+`def*`）: 将軍本人攻撃の命中数（兵士分と別系統）
- `atk/defSolBefore`・`atk/defHpBefore`: 交換前の値（差分アニメ用）
- **反撃**: 成立条件は攻撃側が近接（`action==='attack'`）のみ。守備側タイプ不問。`_calcOneSide(def, atk, _, asCounter=true)` で直接攻撃扱い（間接化/mult低下を抑止）。

---

## 12. デザイントークン

`src/shared/tokens.js` から import。**色の直書き禁止**。

```js
PK='#c4427a', PK2='#9e2d5f', AC='#b87010', AC2='#d4a044',
TEAL='#1a8a96', TX='#1c1020', TXD='rgba(28,16,32,.55)',
TXF='rgba(28,16,32,.24)', BR='rgba(0,0,0,.08)'
glass(extra={})
```

---

## 13. セーブ

`kiritan_save_{slot}`（slot: 1|2|3）。SAVE_VERSION = **9**。
- v7以前: actionPoints=5 / researchQueue=null / upgradeUnlocks=['sp_refill','sp_max_up'] / secretaryId=null を補填
- v8以前: purchasedUpgrades=[] を補填

---

## 14. docs 運用ルール

```
docs/prompts/   ← 作業中のCode引き継ぎプロンプト（PROMPT_<名前>.md）。内容一覧は本ファイルに書かない
docs/archive/   ← 完了済みプロンプト・旧ドキュメント
```

Code引き継ぎプロンプトは `docs/prompts/PROMPT_<名前>.md`、完了後 `docs/archive/` へ移動。新規作成前に `docs/prompts/` の既存を確認し重複回避。

---

## 15. 解決済み（詳細は docs/archive/）

- エンジン単体QA E01〜E16、ワールドマップQA M-01〜D-07、BUG-001〜016 全解消。
- 戦闘バグ: BUG-A/B/C/D、実機6バグ（followup v3: BUG-1〜6）+ ハードニング、実機2バグ（followup v4: モブ現在値>最大値 / 軍団retreatRule結線）全完了。
  - BUG-B（敵防衛者の全勢力員フォールバック漏出）→ `getDefenders` の reserve軍団参照に置換済（コード確認済）。
  - BUG-D（overlay値固着）→ 交換キュー化 + `_onExchangeResult` 契約拡張で解消済。
- 内政 Phase A/B、戦闘背景画像、一括登録拡張、dungeon、エディタ移植、theater統合（Phase 5）、trigger接続（Phase 3）、終盤シナリオ復元（埼玉TL/ボカロTL 計9件・全ダミーテキスト）全完了。
- 参照: `docs/archive/ARCHIVED_QA_BUG_20260519.md`、`PROMPT_battle_*`、`PROMPT_domestic_*` 他。

---

## 16. 残タスク（オープンのみ）

### 機能
1. **new_game_plus** — DEMO_FACTIONS をハードコードから実データへ
2. **gallery / settings / credits** — 実装
3. **Electron化**（マスターアップ後）

### 戦闘
- **保留調査（要 syncDisplay 精読）**: 敵生存カウント「ENEMY UNITS 0/N」誤表示（敵複数生存でも0）／side panel 敵HP表示がエンジン実値と乖離。
- 戦闘エンジンのマジック定数集約（残ハードニング）。
- 戦闘アニメ演出の詳細詰め（Design v5相当）→ 上記安定後。

### シナリオ
- 復元9件のダミーテキスト差し替え。
- charJoin の実合流処理（ウナしゅお/ずん子いたこ解禁。現状フラグのみ）。
- **要ディレクター判断**: `ev_turn1_status`（player_turn turn==1）と `ev_turn2_join_kotohaxsisters`（player_turn turn==2）が共に char_008・char_009 を `charJoin`。前者は flag 未設定のため後者の `noFlag` が通過し2ターン目で再 charJoin。どちらが正か・前者に `setFlag` を持たせるか要決定（ターン入場統一とは独立の既存重複）。
- **要調査**: `ch02_saitama/ev_saitama_chain_3` の `trigger:"turn_start"` は未接続trigger疑い→chain停止で `ev_saitama_chain_4` の `legionForceAttack` 不発の可能性。

### バランス・デザイン（別途設計）
- characters.json の strategyRate / kana 実値調整。
- 野戦/市街戦の判定ロジック（攻撃側兵力・道路状況等）。
- 都市防衛ボーナス・市街戦の数値設計。拠点画像（targetNode.image）設定。

### parked
- **base_visit**: 訪問UI未実装のためスキップ（ディレクター判断待ち）。

---

## 17. キャラクリ（周回要素）— 設計未着手

- 全キャラに個別の「キャラクリ解除条件」。条件達成＋エンディング到達でエピローグ会話挿入・解除。ニューゲームで解除状況に応じたボーナス・特殊ルート解禁。
- 現状: NewGamePlusScene.jsx はUIのみ（DEMO_FACTIONSダミー3件）。解除条件・エピローグ・ボーナス・特殊ルートは全て未設計。
- 着手は dungeon・new_game_plus 接続より後。
- 未定項目: 各キャラ解除条件 / エピローグ会話・ADV連携 / 解除状態の永続化（localStorage別キー等）/ 開始時ボーナスの種類・数値 / 特殊ルート内容。
