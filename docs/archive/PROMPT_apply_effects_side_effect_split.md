# PROMPT_apply_effects_side_effect_split

## 目的

`PROMPT_event_system_redesign` Phase 1 の単一ブロッカーを解消する。
`APPLY_EFFECTS` への副作用エフェクト統合設計を確定し、移植7種を「純粋reducer分」と「副作用分」に分離する。
**これが確定するまで Phase 1（applyEffectToState移植・applyEffects公開）に着手しないこと。** Phase 4（EventEngine._applyEffect廃止）の委譲先もこの設計に依存する。

---

## 調査で判明した現状（コード根拠・着手前に再確認すること）

### APPLY_EFFECTS は純粋reduce畳み込み
- `GameContext.jsx` L229〜L234：`effects` を `applyEffectToState` で `reduce` 畳み込み。副作用を持てない構造
- `applyEffectToState`（L409〜）は対応13種すべて新オブジェクト返却の純粋関数。`actionPointsBonus` を持つ（EventEngine._applyEffect側には無い → 逆方向欠落、タスク1で確認）

### 移植対象7種は均質でない（分類はコードで裏取り済み）

**純粋reducer化が可能（stateで完結）：**
- `dungeonUnlock` … `base.dungeonUnlocked = true`（EventEngine.js L186付近）
- `charUsedThisTurn` … `char.usedThisTurn = true`
- `baseTransferSingle` … `base.factionId = eff.toFactionId`
- `itemLose` … inventory配列操作（ただし下記の差異注意）

**純粋reducerに収まらない（ref保持インスタンスを変異）：**
- `itemGain` … `ws.itemSystem.createInstance(eff.itemId)` でインスタンス生成（EventEngine.js L300付近）。`itemSystem` は `systemsRef.current.itemSystem`（GameContext L721 `new ItemSystem()` / L796 参照）。**インスタンス生成がreducer外**
- `legionForceAttack` … `ws.legionAI.forceAttack(...)`。`legionAI` は `legionAIRef.current`（GameContext L729 `useRef` / L737 `new LegionAI`）。**stateに一切乗らない**
- `legionUpdate` … `legion.factionId` / `legion.attackFrequency` を直接代入（同 ref上のインスタンス）

### 再利用可能な既存action（怠惰：新規追加を避ける）
- `ADD_ITEM`（payload: `item`）GameContext L329
- `REMOVE_ITEM`（payload: `instanceId`）GameContext L332〜L336
- legionの永続化は `serializeMobSlots()` 経由（serializeState L593）。legion系はstateに乗らずとも保存される

### itemLose の差異（見落とし注意）
- `EventEngine._applyEffect` の `itemLose` は `i.itemId === eff.itemId` で**先頭1件をsplice**
- 既存 `REMOVE_ITEM` は `i.id !== instanceId`（インスタンスID検索）
- itemId指定からinstanceID解決が必要、または `applyEffectToState` 内に itemId版 itemLose を新設する。**どちらにするか決めること**

---

## 設計方針（推奨案・Codeがコードで裏取り後に確定）

`useGame()` から `applyEffects(effects)` を公開。中身を「分類オーケストレータ」にする。

```
applyEffects(effects) {
  // 1. 純粋分（既存13種 + 移植4種）→ dispatch一本
  const pure = effects.filter(isPure);
  if (pure.length) dispatch({ type:'APPLY_EFFECTS', payload:{ effects: pure } });

  // 2. itemGain → ref参照でインスタンス生成 → 既存ADD_ITEM
  // 3. itemLose → inventoryからitemId解決 → 既存REMOVE_ITEM
  // 4. legion系 → legionAIRef.current 直呼び（dispatch不要）
}
```

- **案B（推奨）**：APPLY_EFFECTS は純粋分専用。副作用分は既存action（ADD_ITEM/REMOVE_ITEM）と ref直呼びに振り分け。既存資産再利用・reducerを汚さない
- 案A（非推奨）：applyEffectsラッパ内で副作用を先行実行し、生成済みインスタンスをAPPLY_EFFECTSのpayloadに載せる。APPLY_EFFECTSが肥大しreducerに副作用前提が混入

最終判断はCodeがコードで裏取りして決定。推論で確定しないこと。

---

## 実装タスク（優先順）

1. **逆方向欠落の確認**：EventEngine経由で `actionPointsBonus` を発火する既存イベントが存在するか grep。存在すれば移植不要、しなければそのまま（`applyEffectToState` 側にのみ在る現状で問題ないか判断）
2. **副作用3種（itemGain/legionForceAttack/legionUpdate）の確定設計**を上記推奨ベースで決定。`systemsRef` / `legionAIRef` の参照経路をコードで再確認
3. `applyEffectToState` に純粋4種（dungeonUnlock/charUsedThisTurn/baseTransferSingle/itemLose）を移植
4. `useGame()` から `applyEffects(effects)` を公開（オーケストレータ実装）
5. `itemLose` の itemId/instanceId 差異を解消（itemId解決 or reducer内itemId版新設、いずれか確定）

---

## 注意事項

- dispatchを経由しない処理（legion系 ref直呼び）は**React再レンダリングが保証されない**。stateに乗る値は必ずdispatch経由にすること。これは元設計が解消しようとした mutable直書き問題と同じ轍
- legion系はstate外。UI表示にlegion値を使う箇所があるなら、別途反映経路の有無を確認（無ければ表示更新されないバグの新規作り込みになる）
- Phase 1 完了 = 純粋分の移植 + applyEffects公開まで。EventEngine._applyEffect の実廃止は Phase 4（committed: Phase1→Phase4順序厳守）
- 各エフェクトの「純粋/副作用」分類は本プロンプトの裏取り時点のもの。実装時に対象コードで再確認すること（推論で分類を信用しない）
