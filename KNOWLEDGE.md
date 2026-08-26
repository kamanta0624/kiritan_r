# KNOWLEDGE.md — kiritan_r テックリード引き継ぎ

> 最終更新: 2026-08-14（`docs/prompts/` 全破棄。生きているドキュメントを §14 に明示。実装乖離を §16-0 に記録）
> このファイルのみ参照。履歴・完了済みの詳細は docs/archive/ にある。
> **現在の実装を軸に開発を進める。計画書と実コードが矛盾する場合は実コードが正。**

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
  SCENARIO_DRAMA_NOTES.md ← シナリオ軸SSOT（ドラマチック場面・世界観裏設定・クラファンの壁の結論）
  DESIGN_YMM4_SYSTEM.md   ← 演出システムSSOT
  ymm4/                   ← 演出システム設計資料（editor_ymm4_ui / voiro_theater_demo）
  archive/                ← 完了・破棄済みプロンプト・旧ドキュメント（Game.html / DESIGN_DOMESTIC.md 等）
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

### 4-1. テキスト・音声の禁止事項（2026-08-14・厳守）

- **AIはイベントの台詞を1文字も書かない。** イベントJSONのテキストは**すべてダミー**で実装する。台詞の執筆は人間（プロジェクトオーナー）の専任
- **ボイボ音声は「誰に何を喋らせるか」を逐一人間に確認し、返ってきた内容をそのまま実装する。** AIが話者・内容を推測・創作してはならない
- 立ち絵PSD・ボイボ音声の**実装作業そのものは積極的に進めてよい**。禁止されているのは中身（台詞）の創作
- 背景CGは**必要なものをAI側が指定する**。素材の収集は人間が行う（フリー素材）

---

## 5. 用語定義（誤用厳禁）

| 用語 | 正しい意味 |
|------|-----------|
| **ミーム** | **キャラの兵力。`soldiers` フィールド、上限は `maxSoldiers`。ゲームパラメータの正式名称。** 世界観上は「支配下クリエイターの投稿数・フォロー数の換算値」 |
| **参戦** | ミーム（`soldiers`）が `battleCapacity` を下回り将軍本体がダメージを受ける可能性が生じる状態。**戦闘への参加キャラ選出とは別概念** |
| 戦闘域 | `battleCapacity`。この値未満のミームで参戦状態 |
| ミーム上限 | `maxSoldiers`。クラファン挑戦で没収され、戦闘参加で成長する |
| 通貨 | `treasury` フィールド。**「ミーム」とは呼ばない**（P1 で UI 表示は削除済み） |

### 5-1. 呼称の経緯（2026-08-14 最終決定・以後変更しない）

**兵力の呼称は「ミーム」で確定。「SP」は廃止。**

- 旧称は SP。`DESIGN_V2.md` §5.1 / `PHASE_PLAN_V2.md` P5 が「SP→ミーム呼称変更」を計画していた（**この計画が正**、実装は未着手）
- セッション中に「SP に統一」と判断した時期があるが**撤回**。ミームに統一する
- **フィールド名 `soldiers` / `maxSoldiers` は変更しない。** UI 文字列とドキュメント記述のみ「ミーム」

かつて `treasury`（通貨）も「ミーム」と表示していたため呼称が衝突していたが、**P1 で通貨表示を削除済み**のため衝突は解消している。`src/` に残る「ミーム」表記（`ResearchScene.jsx:102,126,399` / `PartyScene.jsx:353,387` / `ItemsScene.jsx:227,234` / `SaveScene.jsx:137` / `GameEndScene.jsx:21`）は**すべて `treasury` を指す旧表記**で、これらの画面は UI 経路が削除済み。

**UI の「SP」表記を「ミーム」へ置換する作業は未実施**（§16 に登録）。

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
| characters | PartyScene.jsx | ✅ | ⚠️ | 勢力絞込・ミーム表示・全画面詳細。`sp_refill`/`sp_max_up` UI は P1 で削除（charUpgrades は残存）。portrait は `/characters/portraits/<id>.png` 規約パス対応済。BUG-06/07（非実在フィールド参照）は要再確認 |
| items | ItemsScene.jsx | ✅ | ✅ | inventory+items.json |
| research | ResearchScene.jsx | ✅ | ✅ | ターン制研究キュー |
| save | SaveScene.jsx | ✅ | ✅ | |
| game_end | GameEndScene.jsx | ✅ | ✅ | |
| adv | ADVScene.jsx | ✅ | ✅ | EventEngine接続・契約 `{script,effects,onExit}` |
| theater | TheaterScene.jsx | ✅ | ✅ | Phase 5統合・events/theater/*.json |
| dungeon_select | （インラインJSX） | ✅ | ✅ | クラファン／浅層探索の選択。BottomBar から入る |
| dungeon | DungeonScene.jsx | ✅ | ✅ | **クラファン挑戦・浅層探索の共通フォーマット**（2026-08-14 Phase C）。進捗%表示・進む／休む・報酬一覧 |
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
  affinity,                // { [pairKey]: number } 好感度。疎管理・0のペアはキーを持たない。
                           // pairKey は charId をソートして '__' 連結。utils/Affinity.js 参照
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
    dungeonExplored(), dungeonDefeat(charIds),  // charHp=1, soldiers=0, penaltyTurns=2（複数キャラ対応）
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
  - クリック順に追加、最大4体。1・2体目→front（**メインキャスト**）/ 3・4体目→rear（**サブキャスト**）。1体以上で出撃可
  - **勝利条件: 相手のメインキャスト2名を戦闘不能にする**（サブキャストの生死は決着に影響しない）

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
- **決着はメインキャスト（`position==='front'`）2名の全滅で判定**（`_mainAlive`）。サブキャストが生存していても敗北。front 不在サイドは side 全体で判定するフォールバックあり（QAシナリオ保護用・実戦では到達しない）
- `battleMode`: `normal`（5R）/ `dungeon`（無制限）/ `duel`（無制限・撤退不可）/ `event`
- **`couplingBonus`（旧 `strategyMult`）**: `{ player, enemy, playerPairs, enemyPairs }`。乱数なし・コンストラクタで1回確定。詳細は `docs/DESIGN_AFFINITY_BATTLE.md`
- **`strategyRate` は戦闘システムから参照しない**（2026-08-14 Phase B）。`characters.json` にデータは残置
- `executeAction()` は async。BattleFlow側も await。
- 特技 `trigger`: `instant`（即時）/ `charge`（集中→必殺）
- `allowRetreat`: dungeon/duel以外 true
- `buildUnit(char, sideType, index)`: index<2→front（**メインキャスト**）/ >=2→rear（**サブキャスト**）
- ターゲットプール: ranged/song→敵全体 / 近接→敵前衛（前衛0なら全体）
- 後衛近接 options: `!isFront && !isRanged && !isSong → ['defend','retreat']` のみ

### `_onExchangeResult(atk, def, result)`（V3.2）

交換結果コールバック。`_resolveExchange` 末尾で発火。BattleScene の `animState` を更新しアニメoverlayを駆動。**N = ミーム命中 + 将軍命中 が常に成立**。
- `atkMem/atkChr/defMem/defChr`: ミーム/HP ダメージ量（兵士＋将軍マージ済）
- `N/Nr`: 攻撃側/反撃側 総突撃数 `min(soldiers, battleCapacity)`
- `atkToMeme/atkToChar`（+`def*`）: 兵士突撃の命中数内訳（ミーム命中＋将軍命中＝N）
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

`kiritan_save_{slot}`（slot: 1|2|3）。SAVE_VERSION = **10**（`src/context/GameContext.jsx:590`）。

**セーブ実装は `GameContext.jsx` の `serializeState` / `deserializeToState` のみ。**
2026-08-14: `src/game/systems/SaveSystem.js`（旧Phaser版由来・`SAVE_VERSION = 7`・どこからも import されないデッドコード）を削除。同じ `kiritan_save_{slot}` キーを持つため「v7とv9の乖離」という誤読を招いていた（DESIGN_V2 §7 の乖離指摘はこれが原因、実際には乖離なし）。削除後 `npm run build` 成功を確認済。`GameContext.jsx:10` / `:570` の「SaveSystem v7互換」コメントはシリアライズ形式の由来を指す記述として残置。

- v7以前: actionPoints=5 / researchQueue=null / upgradeUnlocks=['sp_refill','sp_max_up'] / secretaryId=null を補填
- v8以前: purchasedUpgrades=[] を補填
- v9以前: `affinity={}` を補填（2026-08-14 Phase A）

---

## 14. docs 運用ルール

**2026-08-14: 旧 `docs/prompts/` の中身を全破棄。** 未完12件を含む全プロンプトを `docs/archive/` へ移動。現在の実装を軸に開発を進める方針への転換に伴い、過去プロンプトの計画は無効。**archive は参照専用・復活させない。**

```
docs/prompts/   ← 現行のCode引き継ぎプロンプト（PROMPT_<名前>.md）
docs/archive/   ← 破棄済み・完了済みプロンプト、旧ドキュメント（参照専用）
```

新規のCode引き継ぎプロンプトは本ファイル §16 の残タスクと下記SSOTから起こし、`docs/prompts/` に置く。滞留させず、完了・破棄時は即 `docs/archive/` へ移動。**再び溜め込まないこと。**

### 生きているドキュメント（これ以外は archive 相当）

| ファイル | 役割 |
|---------|------|
| `KNOWLEDGE.md` | 実装状況・現行仕様の正 |
| `docs/ROADMAP.md` | **実装順とアセット調達SSOT**。好感度→クラファン→シナリオ（ボイボ寮・小樽潮風撃破まで）|
| `docs/IMPL_INDEX.md` | コード早引き（どこに何があるか） |
| `docs/SCENARIO_DRAMA_NOTES.md` | **シナリオ軸SSOT**。ドラマチック場面・世界観裏設定・クラファンの壁の結論。ここを軸にシナリオ・プロットへ反映する |
| `docs/DESIGN_CROWDFUNDING.md` | **クラファン／ダンジョン統合設計SSOT**。DESIGN_V2 §4.2 と旧ダンジョン仕様を置き換える |
| `docs/DESIGN_AFFINITY_BATTLE.md` | **好感度／カップリング＋戦闘システム改修SSOT**。§9〜11 の作戦システム・勝利条件を置き換える |
| `docs/DESIGN_YMM4_SYSTEM.md` + `docs/ymm4/` | 演出システムSSOT |
| `docs/wiki/` | ゲームデータのSSOT（chapters は event ID 紐づき） |

`docs/DESIGN_V2.md` / `PHASE_PLAN_V2.md` / `DESIGN_software_dev.md` / `AI_TOOLS_PROPOSAL.md` / `DESIGN_BATTLE_RULES.md` は計画・検討メモ。実装との乖離あり（§16-0 参照）。計画書と実コードが矛盾する場合は**実コードが正**。

---

## 15. 解決済み（詳細は docs/archive/）

- エンジン単体QA E01〜E16、ワールドマップQA M-01〜D-07、BUG-001〜016 全解消。
- 戦闘バグ: BUG-A/B/C/D、実機6バグ（followup v3: BUG-1〜6）+ ハードニング、実機2バグ（followup v4: モブ現在値>最大値 / 軍団retreatRule結線）全完了。
  - BUG-B（敵防衛者の全勢力員フォールバック漏出）→ `getDefenders` の reserve軍団参照に置換済（コード確認済）。
  - BUG-D（overlay値固着）→ 交換キュー化 + `_onExchangeResult` 契約拡張で解消済。
- 内政 Phase A/B、戦闘背景画像、一括登録拡張、dungeon、エディタ移植、theater統合（Phase 5）、trigger接続（Phase 3）、終盤シナリオ復元（埼玉TL/ボカロTL 計9件・全ダミーテキスト）全完了。
- 立ち絵修正: PartyScene / FormationScene / BattleScene は `/characters/portraits/<id>.png` 規約パス + 404時プレースホルダへ統一済。
- イベント/バグ修正: VS大都会 ch01 イベント7件追加、QAふくしま制圧イベント追加、battleEnd の stale ws.bases 修正、エディタ trigger options（`char_defeated`/`theater` + 未登録値防御）修正、水戸制圧時 `baseTransfer` + 防衛キャンセル復帰修正が完了済。
- **v2 方針 P1（UI削除フェーズ）完了**: 研究/アイテムNavButton削除、TopBar通貨/収入表示削除（breadcrumb 側含む）、兵力UI削除（NodePopup/StatTile/MapScene troops生成）、PartyScene 強化コマンドUIレンダリング削除（UPGRADE_COMMANDS 定数は温存）、itemGain effect no-op化、characters.json battleCapacity削除、BaseMenuScene 訪問コマンド削除、NodePopup ホバー化＋ボタン全削除、BaseMenuScene 背景透過化（MapScene を背景レイヤ）、NodePopup 収入表示削除。詳細は `docs/archive/PROMPT_P1_ui_deletion.md` / `PROMPT_P1_addendum.md` / `PROMPT_P1_addendum_fix.md`。
- 参照: `docs/archive/ARCHIVED_QA_BUG_20260519.md`、`PROMPT_battle_*`、`PROMPT_domestic_*` 他。

---

## 16. 残タスク（オープンのみ）

### 16-0. 計画書と実装の乖離（2026-08-14 コード確認）

`docs/DESIGN_V2.md` / `PHASE_PLAN_V2.md` は全フェーズ「実装未着手」と記載するが実態は以下。**表が正。**

| フェーズ | 実態 |
|---------|------|
| P1 UI削除 | **完了**（§15） |
| P2 プロモーション | **`?qa=promotion` 隔離実装済**（`src/scenes/PromotionDevScene.jsx`・`src/game/data/promotion_commands.json`・`tools/editor-modules/tab-promotion.js`）。GameContext非依存・local state・INITIAL_CHARS ダミー。**本体未統合** |
| P3 クラファン | 未着手（シーン不在）。**DESIGN_V2 §4.2 の仕様は破棄済**。`docs/DESIGN_CROWDFUNDING.md`（ダンジョン吸収版）が正 |
| P4 劇場の報酬種別・発生条件スキーマ拡張 | 未着手 |
| P5 SP→ミーム呼称変更 | **未着手。`KNOWLEDGE.md` §5-1 で「ミーム」に確定済み**。UI文字列の置換作業が残る |

- git 最終コミット `0874325`。作業ツリーに未コミット変更125件（`nawabari/` `public/audio/` `public/characters/parts/` promotion系・wiki系ツール・`psd_extract.cjs` 等が未追跡）。
- src/tools の最終更新は 2026-07-25。以後は docs のみ更新。
- `nawabari/`（2026-07-30）は別プロジェクト（猫のなわばりあらそい）。docs のみ・実装ゼロ。kiritan_r 本体とは独立。

### シナリオ軸

`docs/SCENARIO_DRAMA_NOTES.md` をシナリオのSSOTとする。ドラマチック場面を先に固め、後からプロット・event JSON へ反映する方針。
- 未統合: `docs/wiki/chapters/`（event ID紐づき）との整合。反映時は各chapterの events / あらすじと突合すること。
- 同ファイル内の「残課題」（波音リツ代替候補 / 3名選出の回収場面 / 初音ミク編の戦闘描写 / ボカコレ本編の文章化 / 栗田まろんのガイドライン確認 / 冒頭ボスと「クラファンの壁＝例のアレ」の接続）はオープン。

### 完了（2026-08-14）
- **好感度／カップリング＋戦闘システム改修**（Phase A / B）— `docs/DESIGN_AFFINITY_BATTLE.md`
- **クラファン／ダンジョン統合**（Phase C-1〜C-4）— `docs/DESIGN_CROWDFUNDING.md`。拠点付属の迷宮は廃止、進捗ポイント制

### 機能
1. **new_game_plus** — DEMO_FACTIONS をハードコードから実データへ
2. **gallery / settings / credits** — 実装
3. **Electron化**（マスターアップ後）

### 戦闘
- **保留調査（要 syncDisplay 精読）**: 敵生存カウント「ENEMY UNITS 0/N」誤表示（敵複数生存でも0）／side panel 敵HP表示がエンジン実値と乖離。
- 戦闘エンジンのマジック定数集約（残ハードニング）。
- 戦闘アニメ演出の詳細詰め（Design v5相当）→ 上記安定後。

### シナリオ
- 復元9件 + VS大都会 ch01 イベントのダミーテキスト差し替え。
- charJoin の実合流処理（ウナしゅお/ずん子いたこ解禁。現状フラグのみ）。
- **要ディレクター判断**: `ev_turn1_status`（player_turn turn==1）と `ev_turn2_join_kotohaxsisters`（player_turn turn==2）が共に char_008・char_009 を `charJoin`。前者は flag 未設定のため後者の `noFlag` が通過し2ターン目で再 charJoin。どちらが正か・前者に `setFlag` を持たせるか要決定（ターン入場統一とは独立の既存重複）。
- **要調査**: `ch02_saitama/ev_saitama_chain_3` の `trigger:"turn_start"` は未接続trigger疑い→chain停止で `ev_saitama_chain_4` の `legionForceAttack` 不発の可能性。

### バランス・デザイン（別途設計）
- characters.json の kana 実値調整。（`strategyRate` は 2026-08-14 に戦闘システムから切り離したため調整不要）
- **要判断**: `tools/` に `strategyRate` の編集UIが残存（`editor-modules/tab-characters.js:271-275` 作戦成功率スライダー / `bulk-input.html:137,186` 作戦率列 / `editor-modules/tab-promotion.js:9` 戦略率 / `wiki_import.cjs:113,158`）。死んだフィールドの入力UI。エディタから消すか残すか。
- **未検証**: 戦闘カットインの寸法（Phase B で立ち絵を 150×210 → 112×158 に縮小したが実機再描画未実施）。人間QAで要確認。
- **UI表記の置換（旧 v2 P5）**: `src/` の「SP」表記を「ミーム」へ。対象は `PartyScene.jsx:11,12,16,42,283` / `FormationScene.jsx:102,185` / `BattleScene.jsx` の Bar label / `BattleFullQAScene.jsx` / `BattleQAScene.jsx` 等。フィールド名 `soldiers`/`maxSoldiers` は変更しない（§5-1）
- 野戦/市街戦の判定ロジック（攻撃側兵力・道路状況等）。
- 都市防衛ボーナス・市街戦の数値設計。拠点画像（targetNode.image）設定。

### parked
- **base_visit**: 訪問UI未実装のためスキップ（ディレクター判断待ち）。

---

## 17. 音声・立ち絵の生成方式

### 音声（事前生成方式）
イベント JSON の `voice.speakerId` を元にローカル VOICEVOX ENGINE で wav を事前生成し、`public/audio/voice/<eventId>/` に配置する。ADVScene はステップごとに `new Audio(voice.file)` で再生。テキストや話者を変更した場合はエディタの「音声一括生成」ボタンで再生成が必要。ランタイムでの TTS 呼び出しは行わない。

### 立ち絵（リグ定義方式）
PSD を `tools/psd_extract.cjs` でレイヤー分解し `public/characters/parts/<charKey>/` に PNG + `parts.json` を配置。表示レイヤー構成は手書きの `rig.json`（base レイヤー ID 配列 + blink フレーム定義）で制御する。PSDToolKit の命名規約には依存しない。

StandingChar は `rig.json` fetch 成功時にパーツ合成＋自動まばたき表示、失敗時（404）は従来の静止画ポートレートにフォールバック。既存キャラへの影響なし。

対応済みキャラ: `char_006`（彩澄しゅお・4段階まばたき）、`char_017`（四国めたん・3段階まばたき）。

`psd_extract.cjs` に同種のリスクあり（char_006/char_017 は現状動作）: RLEチャンネル解凍で内部計算がズレた場合、以降の全レイヤーの読み出し位置が破壊される（`tools/psd2ymm4.cjs` 作成時に mikoto.psd で実際に発生し修正済み）。

### 発展形（進行中）

ボイロ劇場を土台に、キャラ登場画面全般（ターン開始・戦闘シーン等）へ展開する演出システムを設計中。全体像・現在地・決定事項は `docs/DESIGN_YMM4_SYSTEM.md` を参照（このファイルには詳細を書かない）。

## 18. キャラクリ（周回要素）— 設計未着手

- 全キャラに個別の「キャラクリ解除条件」。条件達成＋エンディング到達でエピローグ会話挿入・解除。ニューゲームで解除状況に応じたボーナス・特殊ルート解禁。
- 現状: NewGamePlusScene.jsx はUIのみ（DEMO_FACTIONSダミー3件）。解除条件・エピローグ・ボーナス・特殊ルートは全て未設計。
- 着手は dungeon・new_game_plus 接続より後。
- 未定項目: 各キャラ解除条件 / エピローグ会話・ADV連携 / 解除状態の永続化（localStorage別キー等）/ 開始時ボーナスの種類・数値 / 特殊ルート内容。
