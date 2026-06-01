# PROMPT_advscene_redesign

## 目的

`PROMPT_event_system_redesign` Phase 2。ADVScene を `{ script, effects, onExit }` 契約へ刷新し、choice断線を解消、choiceエフェクトの即時適用・トップレベルエフェクトのend適用を ADV内部処理へ移す。
**ADVScene刷新と App.jsx の adv起動経路修正は同一PR厳守**（片方だけ変えると全ADV起動が壊れる：本体方針 L206）。

## 前提（完了済み）

- Phase 1：`applyEffects` 公開（GameContext）
- Phase 4：EventEngine が `ws.applyEffects` 委譲。`_runEvent` 内に自前 `ws.applyEffects` 呼びが4箇所残存（L181/188/204/222）。本Phaseで ADV移管に伴い見直す
- Phase 3：trigger接続完了
- **行番号はずれている。各タスク着手前にコードで再特定**

---

## 調査で判明した現状（コード根拠・着手前に再確認）

### ADVScene.jsx
- `ADVScene`（default、L666付近）props：`{ scenario, cast, bg, location, onExit, onChoice, transparent }`。**`useGame` 未使用**（applyEffects呼び出しは新規追加）
- `convertEventScript`（named export、L586付近）：script→`{ scenario, cast, bg, location }`。`CHAR_ID_MAP`（L573）と castMap生成（L598）を内包。**choiceステップは変換しない**（L614「ChoiceUIで処理／EventEngine経由では未使用」）
- `ChoiceUI`（L625）：`onSelect={(value) => onChoice?.(value)}`（L808）。**断線**（親 `_onChoice` 未配線）
- end到達で `onExit()`（L676/700/713付近）

### App.jsx：adv起動は2経路（両方が契約変更の影響対象）
1. **startDialogHandler**（L73〜L75）：`(script, onComplete) =>` で `convertEventScript(script)` → `navigate('adv', { scenario, cast, bg, location, returnTo:'map', _onComplete })`
2. **TheaterScene**（L588〜L605）：`navigate('adv', { scenario, cast:[], bg, location, returnTo:'theater', _onComplete: () => onComplete effects(setFlag)適用 })`。theater自体の機能刷新はPhase 5だが、**adv props契約変更には追随必須**（でないとtheater→adv破壊）
- `adv` ケース（L678〜L690）：`onExit={() => { _onComplete?.(); navigate(returnTo ?? 'map'); }}`、`onChoice={(value) => _onChoice?.(value)}`（`_onChoice` 未設定＝断線）
- import：`import ADVScene, { convertEventScript } from './scenes/ADVScene.jsx'`（L23）

### 影響しない `_onComplete`（変更禁止）
- `navigate('enemy_turn', { _onComplete: resolve })`（L204/L216）はカットイン演出のPromise。**advと無関係。触らない**

### EventEngine._runEvent（startDialog契約）
- 現契約 `ws.startDialog(scriptWithCallback, onComplete)`（L214付近）。`onComplete` で end後処理
- 自前 `ws.applyEffects` 呼び：default適用（L181/188）、choice `_onSelect` 内（L204）、end `pendingEffectsKey` 遅延適用（L222）
- `buildWsAdapter().startDialog = (script, onComplete) => startDialogRef.current(script, onComplete)`（GameContext、startDialogRef L796付近）

---

## 設計方針（本体プロンプト確定・変更不可）

- ADVの責務：script表示 / choice分岐をADV内部処理 / `useGame().applyEffects(effects)` でエフェクト反映 / 呼び出し元は `{ script, effects }` を渡すだけ
- `returnTo` / `_onComplete` / `_onChoice` / `cast` は廃止。**ADVは戻り先を知らない**。戻り先制御は呼び出し元のコールバックに閉じる
- choiceのeffectsは選択時即時適用。非choiceのトップレベルeffectsはendステップ到達時に適用
- effects適用は EventEngine自前でなく ADV内部 `applyEffects` に一本化

---

## 実装タスク（同一PR・段階）

### 段階A：ADVScene.jsx
1. props を `{ script, effects, onExit }` に整理
   - `cast` は script の characterId から内部生成（castMap + `CHAR_ID_MAP` ロジックをADV内部へ移動）
   - `bg` / `location` は `script.meta` から取得
2. `ChoiceUI` の `onSelect` を内部処理化：選択肢の `effects` を `useGame().applyEffects` で即時適用 → 次ステップへ。`onChoice` prop は除去
3. endステップ到達時、トップレベル `effects`（choice未選択時のデフォルト）を `applyEffects` で適用。`onExit` は終了通知のみ
4. choiceステップの内部表示処理を追加（現状 convertEventScript が choice を scenario に入れていないため、script の choice を ADV が直接扱う経路を作る）
5. **描画ロジック非変更**（ADVScene は Design納品物混在：KNOWLEDGE §11）。追加は applyEffects呼び出し・choice分岐・script内部変換のロジックのみ

### 段階B：startDialog契約変更（3箇所同時・本体 L33-43）
6. `buildWsAdapter().startDialog` を新契約に（`onComplete` 廃止、`{ script, effects }` を渡す形）。`startDialogRef` 同期も追随
7. App `setStartDialogHandler` 登録（L73）を新契約に：`(script, effects) => navigate('adv', { script, effects })`。戻り先（map）は onExit コールバック内に閉じる
8. EventEngine `_runEvent`（L214）の `ws.startDialog(...)` を新契約呼び出しに

### 段階C：App.jsx adv経路
9. `adv` ケース（L678）props を `{ script, effects, onExit }` に。`onExit` は `navigate('map')` 等の戻り制御のみ。`_onComplete`/`returnTo`/`_onChoice`/`onChoice` 除去
10. TheaterScene経路（L588-605）も新契約へ移行：`scenario/cast/returnTo/_onComplete` → `script` + `effects`（onComplete の setFlag群を effects 形式へ載せ替え）。theater機能刷新本体はPhase 5、ここは契約追随のみ

### 段階D：EventEngine自前effects廃止 + 後始末
11. `_runEvent` の自前 `ws.applyEffects` 呼び（default L181/188、choice `_onSelect` L204、end `pendingEffectsKey` L222）を廃止。effects は script と共に ADV へ渡し ADV側で適用。`_onSelect` 注入・`pendingEffectsKey`/`effectsKey` 遅延ロジック削除
12. `convertEventScript` の扱い：ADV内部処理化で役割消滅 → 廃止。App L23 import と L74 呼び出しを除去（縮小に留める判断もコードで裏取り後に可）

---

## 注意事項

- **同一PR厳守**。段階A〜Dを分割マージしないこと。adv契約は startDialogHandler / TheaterScene の2経路から使われ、片方だけだと起動破壊
- `useGame().applyEffects` を ADV が呼ぶには GameProvider配下が必須。`adv` ケースは Provider内でレンダリング済（確認済）
- `effectsKey` 遅延適用を使う既存イベントは無い（本体確認済）が、**削除前に再grep**
- `enemy_turn` の `_onComplete`（L204/216）は変更禁止（adv無関係）
- Phase 4で入れた `_runEvent` 内 `ws.applyEffects` 4箇所は本Phaseで ADV へ移管。EventEngineの責務は script+effects構築のみに収束
- TheaterScene の本格刷新（`getAvailableTheaterEvents` 使用・条件評価）はPhase 5。本Phaseは契約追随の最小変更のみ

---

## 完了後

- 本プロンプトを `docs/archive/` へ移動
- KNOWLEDGE §8（ADVScene仕様）を新契約に更新。§8-1フロー図・§8-3 startDialog登録・§8-4 の記述を実態に合わせる
- 残：Phase 5（TheaterScene統合）
