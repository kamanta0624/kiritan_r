# PROMPT_event_system_redesign

## 目的

イベントシステム（ADVパート・EventEngine・エフェクト適用）の設計を刷新し、以下を解消する。

- ADV呼び出し経路が分裂（EventEngine経由 / TheaterScene直 / convertEventScript）
- エフェクト適用がEventEngine内のwsアダプタmutable直書きになっており、Reactのstateと不整合の温床
- choice分岐がADVScene側で断線（後述）
- 複数triggerが未接続（base_defense / base_visit / char_defeated / battle_start / battle_end）
- theaterイベントがEventEngineと別系統で条件評価ロジックが重複
- EventEngineのplayer_turn以外でeligible[0]の1件しか発火しない

---

## 調査で判明した現状（コード根拠・実装前に必読）

### EffectEngineは半分実装済み
- `GameContext.jsx` reducer内に純粋関数 `applyEffectToState(state, eff)` が存在（L409〜）
- `APPLY_EFFECTS` dispatchアクションも存在（L229〜L234）。`effects`配列をreduceで畳み込む
- **ただし `applyEffectToState` が対応しているのは以下のみ**：
  `treasury` / `charJoin` / `charLeave` / `charParam` / `baseIncome` / `battleCap` / `baseTransfer` / `warFlag` / `attackUnlock` / `setFlag` / `setFlagWithTurn` / `clearFlag` / `actionPointsBonus`
- **未対応（EventEngine._applyEffect側にしかない）**：
  `dungeonUnlock` / `itemGain` / `itemLose` / `charUsedThisTurn` / `baseTransferSingle` / `legionForceAttack` / `legionUpdate`
- すなわち「EffectEngineを新規実装」ではなく「`applyEffectToState`に未対応7種を移植し、EventEngine._applyEffectを廃止して全部dispatch経由に寄せる」が正しいタスク

### EventEngine._applyEffect はmutable直書き（状態不整合の根本原因）
- `EventEngine._applyEffect(ws, eff)` は `ws.factions` / `ws.characters` / `ws.bases` の要素を直接代入で書き換える（L246〜L378）
- wsアダプタ（`buildWsAdapter`, L769〜）は `stateRef.current` の配列をそのまま参照渡ししている
- つまりReactのstateオブジェクトを直接mutateしている。dispatchを経由しないため再レンダリングが保証されず、stateRefとReact stateが乖離する
- **これがイベント後に画面が更新されない/古い値が残る系バグの最有力候補**（推論。実装時にコードで裏取りすること）

### startDialogは (script, onComplete) の2引数契約
- `buildWsAdapter().startDialog = (script, onComplete) => startDialogRef.current(script, onComplete)`（L787〜）
- `GameContext.setStartDialogHandler(fn)` でApp.jsxが登録（L753〜）
- App.jsx登録実体（L70〜）：
  ```
  game.setStartDialogHandler((script, onComplete) => {
    const { scenario, cast, bg, location } = convertEventScript(script);
    navigate('adv', { scenario, cast, bg, location, returnTo:'map', _onComplete:onComplete });
  });
  ```
- `{ script, effects }` 方式に変えるならこの3箇所（EventEngine._runEvent / buildWsAdapter.startDialog / App.jsx登録）を同時に変更する

### choice分岐が断線している
- `EventEngine._runEvent` はchoiceステップに `_onSelect` コールバックを注入済み（L184〜L206）。選択肢の `effects` 即時適用ロジックもここにある
- **しかしADVScene `ChoiceUI` は `onSelect={value => onChoice?.(value)}` を呼ぶだけ（ADVScene L最終部）**。App.jsxの `adv` ケースは `onChoice={value => sceneParams._onChoice?.(value)}` だが、`_onChoice` はどこからも渡されていない
- 結果：**choiceイベントは選択しても `_onSelect` が呼ばれずeffectsが適用されない**。現状choiceを持つ本番イベントが無いため顕在化していないだけ
- 設計刷新（choice即時適用・ADV内部処理）はこの断線を正す方向と一致する

### base_visitは接続先UIが存在しない
- `BaseMenuScene.jsx` 冒頭コメントに「→ adv (訪問)」とあるが、訪問ボタンの実体は無い
- App.jsx `base_menu` ケースの `onNavigate` にも `adv` 分岐なし
- base_visitは「トリガー発火コードを書く」前に「訪問UIをBaseMenuSceneとApp.jsxに作る」必要がある。データも無い。最後回し

### EventEngine冒頭コメントは旧Phaser版の名残
- ファイル先頭の呼び出し元説明が「WorldMapScene」前提（L9〜L16）。実態はGameContext/App.jsx。修正時にコメントも実態に合わせる

---

## 設計方針（議論確定済み・変更不可）

### ADVの責務
- scriptを表示する
- 選択肢分岐をADV内部で処理する
- `useGame().applyEffects(effects)` を呼んでエフェクトを反映する
- 呼び出し元は `{ script, effects }` を渡すだけ
- `returnTo` / `_onComplete` / `_onChoice` / `cast` は廃止。ADVは戻り先を知らない
- choiceのeffectsは選択時即時適用。非choiceのトップレベルeffectsはendステップ到達時に適用

### EffectEngine
- 新規モジュールではなく、既存 `applyEffectToState` + `APPLY_EFFECTS` dispatchを正とする
- `applyEffectToState` に未対応7種（dungeonUnlock/itemGain/itemLose/charUsedThisTurn/baseTransferSingle/legionForceAttack/legionUpdate）を移植
- `useGame()` から `applyEffects(effects)` を公開（中身は `dispatch({type:'APPLY_EFFECTS', payload:{effects}})`）
- itemGain/legionForceAttack/legionUpdate はitemSystem/legionAIへの副作用を含むため、純粋関数に収まらない分はaction側で処理する設計を検討
- EventEngine._applyEffect / EventEngine.applyEffects は最終的に廃止

### EventEngine
- 責務：条件判定・イベント選出・script+effects構築のみ
- エフェクト適用はGameContext.applyEffectsに委譲（自前のmutable書き換えを廃止）
- `getAvailableTheaterEvents(ws)`: theaterトリガーの条件を満たすイベント一覧を返す新規staticメソッド
- player_turn以外も複数発火可能にする（else分岐をeligible全件ループに）

### triggerの全接続
| trigger | 発火元 | 現状 |
|---|---|---|
| game_start | GameContext.startNewGame() L869 | ✅ |
| player_turn | GameContext.startPlayerTurn() L845 | ✅ |
| enemy_turn | GameContext.runEnemyPhase() L815 | ✅ |
| before_faction_turn | GameContext.runEnemyPhaseForFaction() L824 | ✅ |
| base_attack | GameContext.beforeAttack() L927 | ✅ |
| base_defense | App.jsx startDefenseQueue() L171 直前 | ❌ 要接続 |
| base_visit | BaseMenuScene訪問UI（未実装） | ❌ UIごと要新設・最後回し |
| base_conquered | GameContext.battleEnd() L896 | ✅ |
| battle_start | BattleScene初期化（props経由） | ❌ 要追加 |
| battle_end | GameContext.battleEnd()内 | ❌ 要追加 |
| char_defeated | GameContext.battleEnd()内（result使用） | ❌ 要追加 |
| theater | TheaterScene.getAvailableTheaterEvents() | ❌ 要追加 |

---

## 実装タスク（優先順・各PhaseはCodeが着手前にコードで裏取りすること）

### Phase 1: EffectEngine統合（基盤）

**GameContext.jsx**
- `applyEffectToState` に未対応7種を移植：dungeonUnlock / itemGain / itemLose / charUsedThisTurn / baseTransferSingle / legionForceAttack / legionUpdate
  - itemGain/itemLose: inventory操作。itemSystemのcreateInstanceが絡むためaction層で処理が必要か検討
  - legionForceAttack/legionUpdate: legionAIへの副作用。純粋関数に収まらないためaction層で処理
- `useGame()` から `applyEffects(effects)` を公開（`dispatch({type:'APPLY_EFFECTS', payload:{effects}})` のラッパ）
- mutable直書き問題の解消はEventEngine._applyEffect廃止（Phase 4）とセットで完了する

### Phase 2: ADVScene刷新

**ADVScene.jsx**
- propsを `{ script, effects, onExit }` に整理
  - 現行props `scenario / cast / bg / location / transparent / onChoice` を見直し
  - `cast` はscriptのcharacterIdから内部生成（convertEventScriptのcastMapロジックをADV内部へ移動）
  - `bg` / `location` はscriptのメタ情報（`script.meta`）として持たせる
- `ChoiceUI` の `onSelect` を内部処理に変更：選択肢の `effects` を `useGame().applyEffects` で即時適用してから次ステップへ
  - 現行の `onChoice?.(value)` 断線を解消
- endステップ到達時、scriptトップレベルの `effects`（choice未選択時のデフォルト）を `applyEffects` で適用
- `onExit` は終了通知のみ。戻り先は渡さない
- `CHAR_ID_MAP`（char_NNN → c1等）はconvertEventScript内にある。ADV内部移動時に一緒に移すこと

**App.jsx**
- L70 `setStartDialogHandler` 登録を新インターフェースに変更
- L690〜 `adv` ケースのprops（scenario/cast/bg/location/returnTo/_onComplete/_onChoice）整理
- `onExit` 内の `_onComplete?.()` + `navigate(returnTo)` パターンを見直し
  - 戻り先制御は呼び出し元（startDialogハンドラ）のコールバック内に閉じる

**convertEventScript（ADVScene.jsx named export, App.jsxがimport）**
- ADV内部処理化に伴い役割縮小または廃止
- 廃止する場合、App.jsx L22 のimportとL71の呼び出しを除去

### Phase 3: trigger接続

**GameContext.jsx battleEnd()（L877〜）**
- `base_conquered` 発火の直後に `battle_end` 発火を追加
  - `EventEngine.processTrigger(ws, 'battle_end', { conquered, defenderBaseId, winnerFactionId })`
- `char_defeated` 発火を追加
  - `result.unitResults`（id/soldiers/charHp）と `result.deadCharIds` を使う
  - **注意**：現状 `deadCharIds` はプレイヤー側戦闘不能のみ（BattleScene onBattleEnd L1240付近、`e.playerSide.filter(charHp<=0)`）。敵キャラ撃破は含まれない
  - 敵撃破を取るにはBattleScene側で `unitResults` のenemySide由来かつ非モブの `charHp<=0` を別フィールドに出す必要がある（Phase 3 BattleScene項）
  - 撃破ID各々に `processTrigger(ws, 'char_defeated', { defeatedCharId })` を直列await

**App.jsx startDefenseQueue()（L171〜）**
- キュー先頭処理前に `base_defense` 発火を追加
  - GameContextに `processTrigger` を公開するか、`base_defense` 専用actionを追加
  - 現状App.jsxは `buildWsAdapter` に触れない（非公開）。`game.actions` 経由の口が必要
  - 案：GameContextに `actions.fireTrigger(trigger, ctx)` を追加（内部で `buildWsAdapter` → `EventEngine.processTrigger`）。battle_startもこれを使う

**BattleEngineV3.js**
- `opts.onCharDefeated(unit)` コールバックを追加
- コンストラクタで `this._onCharDefeated = opts.onCharDefeated ?? (()=>{})`
- `_applyPenalty(unit)`（L最終部、charHp<=0検知箇所）で `this._onCharDefeated(unit)` を発火
  - ただしchar_defeatedのGameContext発火はbattleEnd集約で足りる可能性が高い。BattleEngine側フックは「戦闘中の撃破演出」が必要になった場合のみ。**まずはbattleEnd集約で実装し、エンジン側フックは保留**

**BattleScene.jsx（Design納品物混在のため変更最小化）**
- `onBattleStart` props追加。エンジン初期化useEffect末尾（`eng.startRound()` 直前, L1300付近）で `onBattleStart?.()`
- `battleResultRef.current`（L1230付近）に `defeatedEnemyCharIds` を追加
  - `e.enemySide.filter(u => u.charHp<=0 && !u.char._isMobInstance).map(u=>u.char.id)`
- App.jsxの2つのBattleScene生成箇所（攻撃L420付近 / 防衛L260付近）に `onBattleStart` を渡し、`fireTrigger('battle_start', {...})` を発火

**App.jsx battle_start ctx**
- 最低限 `playerCharIds`（出撃キャラID配列）を含める。「特定キャラ参戦時のみ発火」条件のため
- 対象拠点 `baseId` も含めると条件記述の幅が広がる

### Phase 4: EventEngine刷新

**EventEngine.js**
- `processTrigger` のelse分岐（L77〜L81）を eligible 全件ループに変更
  ```
  for (const ev of eligible) await EventEngine._runEvent(ws, ev, ctx);
  ```
- `_runEvent`（L168〜）のエフェクト適用を `ws.applyEffects(effects)` 委譲に変更
  - `ws.applyEffects` を `buildWsAdapter` に追加（中身は `dispatch({type:'APPLY_EFFECTS'...})`）
  - `EventEngine.applyEffects` / `_applyEffect`（L355〜L378）を廃止
  - choiceの `_onSelect` 内 `EventEngine.applyEffects(ws, c.effects)` も `ws.applyEffects(c.effects)` に置換
- `getAvailableTheaterEvents(ws)`: staticメソッド追加
  - `_loadAllEvents()` → `trigger==='theater'` → `_filterEligible(ws, _, {})` で返す
  - 戻り値はEventDef配列（id/name/priority等）
- 冒頭コメント（L1〜L30）を実態（GameContext/App.jsx）に修正

### Phase 5: TheaterScene統合

**TheaterScene.jsx**
- App.jsx L640〜が `events={eventsData}`（events.json）を渡し、独自に条件評価＋ダミーADV生成している
- 独自条件評価を削除し、`EventEngine.getAvailableTheaterEvents(ws)` の結果を表示
- `onStartTheater(eventId)` を `EventEngine._runEvent(ws, ev, {})` 直呼びに変更（行動力消費はそのまま）
- wsアダプタ取得のため `game.actions.fireTrigger` 相当か、`buildWsAdapter` 公開が必要

**App.jsx theater ケース（L630〜）**
- ダミーscenario生成（narration2行）を削除
- `eventsData` import（L5）と `onStartTheater` 内のダミーロジックを除去

**events.json / _index.json**
- 現行 events.json（フラット配列, theater_sample_001のみ）を廃止
- theaterイベントを個別JSON化し `_index.json` に登録、`trigger:'theater'` を付与

---

## 注意事項

- Phase順序厳守：Phase 1（applyEffects公開）→ Phase 4（EventEngine委譲）の順。逆だとEventEngineの委譲先が無い
- ADVScene刷新（Phase 2）とApp.jsx adv ケース修正は同一PR内で行う。片方だけ変えると全ADV起動が壊れる
- BattleScene.jsxはDesign納品物がマージされている。変更はprops追加とresult拡張のみに留め、描画ロジックに触れない
- char_defeatedはまずbattleEnd集約で実装。BattleEngineV3へのフック追加は戦闘中演出が要件化したときのみ
- base_visitはトリガー以前に訪問UIが無い。UI新設はディレクター判断待ち。当面スキップ
- mutable直書き廃止（Phase 1+4）が完了するまで、イベント後の画面更新不整合バグの真因特定は保留（推論で原因断定しない）
- choice即時適用への変更で、現行の「endステップ effectsKey による遅延適用」（_runEvent L208〜）は廃止。effectsKey方式を使う既存イベントが無いことを確認済みだが、削除前に再grep推奨
