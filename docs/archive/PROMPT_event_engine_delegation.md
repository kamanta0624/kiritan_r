# PROMPT_event_engine_delegation

## 目的

`PROMPT_event_system_redesign` Phase 4。EventEngineの自前mutable直書き（`_applyEffect`）を廃止し、Phase 1で公開した `GameContext.applyEffects` へ委譲する。あわせて複数発火に対応する。
これでmutable直書きによるReact state乖離を根治する。**Phase 3（trigger接続）着手の前提。逆順厳禁**（EventEngineがmutableのままtriggerを増やすと、新接続triggerがそのまま不整合バグになる）。

## 前提（完了済み・archive参照）

- Phase 1 完了：`applyEffects(effects)` 公開（GameContext L1096）、純粋分は `APPLY_EFFECTS` dispatch、itemGain/legion系は副作用として個別処理済み
- 詳細：`docs/archive/PROMPT_apply_effects_side_effect_split.md`

---

## 調査で判明した現状（コード根拠・着手前に再確認）

### 置換対象：EventEngine の自前エフェクト適用
- `_runEvent` 内 `EventEngine.applyEffects(ws, ...)` 呼びは**4箇所**：EventEngine.js L179 / L186 / L202（choice `_onSelect` 内）/ L220
- `EventEngine.applyEffects`（L246）末尾に `ws.scene?.get('UIScene')?.updateTurn` / `ws.refreshMap`（旧Phaser名残）。wsアダプタは `scene:null` / `refreshMap:null`（GameContext L838付近）=現状no-op。委譲後はGameContext側applyEffectsがReact再レンダを起こすため不要
- `EventEngine._applyEffect`（L260）/ `EventEngine.applyEffects`（L246）は最終削除

### 複数発火
- `processTrigger` else分岐（EventEngine.js L78〜L82）が `eligible[0]` の単発。全件ループへ変更

### 配線の罠（最重要・TDZ）
- `buildWsAdapter`（GameContext L811、`useCallback` deps空 `[]`）に `applyEffects` を追加する
- 中身はPhase 1の `applyEffects`（L1096）。**`applyEffects` は `buildWsAdapter`（L811）より後方で宣言されている**
- `buildWsAdapter` のdeps配列に `applyEffects` を直書きすると、定義時点で未宣言参照 → **TDZ ReferenceError**
- 既存ref（`systemsRef` L760 / `legionAIRef` L772 / `stateRef` L773 / `startDialogRef` L796）は全て `buildWsAdapter` より前で宣言。後方なのは `applyEffects` のみ
- 回避（いずれか・Codeがコードで裏取り後に選択）：
  - **案1（推奨・既存流儀）**：`startDialogRef`（L796）と同じref経由。`applyEffectsRef = useRef(null)` を宣言し `useEffect` で `.current` 同期、`buildWsAdapter` 内に `applyEffects: (e) => applyEffectsRef.current?.(e)`。deps変更不要・TDZ回避
  - 案2：`applyEffects` 定義（L1096）を `buildWsAdapter`（L811）より前へ移動。参照する `systemsRef`/`legionAIRef`/`dispatch` は前方で定義済のため移動可。ただし派生値定義との順序に注意

---

## 実装タスク（優先順）

### EventEngine.js
1. `_runEvent` の `EventEngine.applyEffects(ws, X)` 4箇所（L179/186/202/220）を `ws.applyEffects(X)` に置換。choice `_onSelect` 内（L202）も同様
2. `EventEngine.applyEffects`（L246）/ `_applyEffect`（L260）を削除。**削除前に外部参照を再grep**（他モジュールから呼ばれていないか）
3. `processTrigger` else分岐（L78〜L82）を eligible 全件ループに：
   ```
   for (const ev of eligible) await EventEngine._runEvent(ws, ev, ctx);
   ```
4. `getAvailableTheaterEvents(ws)` static追加：`_loadAllEvents()` → `trigger==='theater'` → `_filterEligible(ws, _, {})` で EventDef配列返却（**使用はPhase 5**。Phase 4では追加のみ・呼び出し元なしで害なし）
5. 冒頭コメント（L1〜L30、WorldMapScene前提）を実態（GameContext/App.jsx）に修正

### GameContext.jsx
6. `buildWsAdapter`（L811）に `applyEffects` を配線。上記TDZ回避案で実装。`scene`/`refreshMap` は委譲後no-opだが既存のまま残置可

---

## 注意事項

- `ws.applyEffects` 委譲で itemGain/legion副作用もGameContext applyEffates経由=Phase 1で配線済の正規経路に乗る。EventEngine側で副作用を再実装しないこと
- **複数発火時のstateRef更新タイミング（要コード確認）**：全件ループで複数イベントを順次await発火する場合、各イベントの `applyEffects` は個別dispatch=React非同期バッチ。後続イベントが前イベントのeffect結果（flag/treasury等）を `stateRef.current` で参照するなら、未反映の可能性。`stateRef` の同期機構（どのuseEffectで `.current` 更新か）をコードで確認し、必要なら同期挿入。**推論で大丈夫と断定しない**
- `pendingEffectsKey` / `effectsKey` 遅延適用（_runEvent L210〜L222）は本体方針でchoice即時適用化（Phase 2）時に廃止予定。**Phase 4では触らず現状維持**（`ws.applyEffects` への置換のみ）
- Phase 4完了後にPhase 3着手。Phase 2（ADV刷新）はPhase 4と独立だが別PR

---

## 完了後

- 本プロンプトを `docs/archive/` へ移動
- 次：Phase 3（trigger接続。`fireTrigger` 口の新設要否を含む）の引き継ぎ切り出し
