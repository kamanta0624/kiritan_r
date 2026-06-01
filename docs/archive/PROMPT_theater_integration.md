# PROMPT_theater_integration

## 目的

`PROMPT_event_system_redesign` Phase 5（最終）。TheaterScene を `EventEngine.getAvailableTheaterEvents(ws)` ベースに統合し、独自条件評価・ダミーADV生成を廃止する。theaterイベントを events/個別JSON に移行し `_index.json` 登録・`trigger:'theater'` 付与する。

## 前提（完了済み）

- Phase 1：`applyEffects` 公開
- Phase 2：ADV新契約 `{ script, effects, onExit }`。`startDialogHandler` は `(script, effects, onComplete)`、ADV終了時 `onExit` で `navigate('map')` + `onComplete?.()`（App L75〜L79）
- Phase 3：`fireTrigger`（GameContext L1005、buildWsAdapter共通口）
- Phase 4：`getAvailableTheaterEvents(ws)`（EventEngine L256付近、`_loadAllEvents().filter(trigger==='theater')` → `_filterEligible`）
- **行番号はずれている。着手前にコードで再特定**

---

## 調査で判明した現状（コード根拠・着手前に再確認）

### イベントデータは2系統。theaterは未統合
- `_loadAllEvents()`（EventEngine L47）は `import indexData from '../data/events/_index.json'`（L37）+ `import.meta.glob('../data/events/**/*.json')`（L40）を参照。**`events.json`（フラット配列）は読まない**
- `getAvailableTheaterEvents`（L256）は `_loadAllEvents()` から `trigger:'theater'` を探す。**現状 events/ 配下に `trigger:'theater'` のJSONが無く、空を返す**
- theaterイベント実体は `src/game/data/events.json` の `theater_sample_001`（`type:'theater'`, `cost.actionPoints:1`, `script:'event_sample_001'`, `conditions:{...}`）。`script` は別ファイル参照（`event_sample_001` の実体所在を移行時に確認）
- `_index.json` 構造：`{ events:[{ id, path, chapter }] }`。新規追加はここに登録

### TheaterScene.jsx（独自評価）
- props：`events` / `actionPoints` / `onStartTheater`（L28〜）。`useGame` 未使用
- `events.filter(type==='theater')`（L41）→ 独自条件評価 `visible`（L43〜）→ カテゴリ分類表示
- `canAct = actionPoints >= 1`（L62）。`onStartTheater(ev.id)`（L143）

### App.jsx theater ケース（L578〜）
- `events={eventsData}`（L581）、`eventsData` import（L5）
- `onStartTheater(eventId)`：`eventsData.find` → 行動力消費 `setActionPoints(actionPoints - 1)`（L593）→ ダミー（Phase 2で `script.meta.location` + `effects.default` に追随済の暫定navigate）

### ws取得とカプセル化
- `buildWsAdapter` は非公開（L816）。`fireTrigger`（L1005）が「非公開buildWsAdapterに触れない呼び出し元のための共通口」。theaterも同様にGameContext内で ws を組む口が要る

### ★最重要設計課題：theater起動ADVの戻り先
- 本体方針は `onStartTheater` を `EventEngine._runEvent(ws, ev, {})` 直呼びに変更。`_runEvent` は `ws.startDialog({script,effects})`（EventEngine L200）でADV起動
- **しかし `startDialogHandler` の `onExit` は `navigate('map')` 固定（App L78）**。theaterから `_runEvent` 経由でADVを起動すると、終了後 theater でなく map に戻る回帰になる
- これを解決しない限り `_runEvent` 直呼びは theater戻りを壊す。**設計の核心**

---

## 設計方針（本体プロンプト確定）

- TheaterScene 独自条件評価を削除し `getAvailableTheaterEvents(ws)` の結果を表示
- `onStartTheater(eventId)` を `_runEvent(ws, ev, {})` 直呼びに（行動力消費はそのまま維持）
- ws取得は GameContext の口経由（`buildWsAdapter` 公開はしない）
- events.json 廃止、theaterイベントを個別JSON化・`_index.json` 登録・`trigger:'theater'` 付与

---

## 実装タスク（段階）

### 段階A：データ移行
1. `theater_sample_001`（events.json）を `events/` 配下に個別JSON化（例 `system/` か新規 `theater/`）。`trigger:'theater'` 付与、`cost.actionPoints` 維持、`script` 実体（`event_sample_001`）の所在を確認し参照を解決
2. `_index.json` に登録（id/path/chapter）
3. `events.json` 廃止。App import（L5 `eventsData`）除去

### 段階B：GameContext 実行口（buildWsAdapter非公開維持）
4. `getTheaterEvents()` 追加：`const ws = buildWsAdapter(); return EventEngine.getAvailableTheaterEvents(ws);`（同期）。`actions` 公開
5. `runTheaterEvent(eventId)` 追加：`const ws = buildWsAdapter();` → 該当 EventDef 取得 → `await EventEngine._runEvent(ws, ev, {})`。`actions` 公開。行動力消費の所在（呼び出し元App維持 or ここへ移動）を決める

### 段階C：★戻り先課題の解決（段階B/Dと一体）
6. theater起動ADVが終了後 theater に戻る経路を確保。案（コードで裏取り後に選択）：
   - **案1**：`setStartDialogHandler` の戻り先をパラメータ化。`_runEvent` 経路では使えない（startDialog契約に戻り先が無い）ため、theaterは `_runEvent` を経由せず App が `ev.script`/`ev.effects` を直接 `navigate('adv', { script, effects, onExit:()=>navigate('theater') })` で起動（本体「_runEvent直呼び」から外れる代わり戻り先を呼び出し元が制御。Phase 2の「戻り先は呼び出し元に閉じる」と整合）
   - **案2**：`runTheaterEvent` が一時的に戻り先を theater に切り替える状態を持ち、ADV onExit がそれを参照。startDialogHandler を拡張
   - 案1が Phase 2方針（ADVは戻り先非保持・呼び出し元が制御）と最も整合。本体の「_runEvent直呼び」は条件評価/effects構築の再利用が目的だが、theater候補は `getTheaterEvents` で取得済のため App が script/effects を直接渡しても二重評価にならない

### 段階D：TheaterScene + App
7. TheaterScene：独自 `filter`/条件評価（L41-43〜）削除。`getTheaterEvents()` 結果を表示。`events` prop を `theaterEvents`（取得済配列）に。`actionPoints`/`canAct`/カテゴリ表示は維持
8. App theater ケース（L578）：`events={game.actions.getTheaterEvents()}`、`onStartTheater` のダミーscenario削除 → 段階Cの確定経路で起動。行動力消費（L593）維持

---

## 注意事項

- **段階A〜Dは一括**。データ移行だけ先行すると getTheaterEvents が拾えず TheaterScene 空表示
- 戻り先課題（段階C）を未解決のまま `_runEvent` 直呼びにすると theater→ADV→map の回帰。**着手前に必ず戻り先設計を確定**
- `getAvailableTheaterEvents` の条件評価鮮度は KNOWLEDGE §8-5 の制約に従う（候補取得は表示時1回）
- TheaterScene の独自カテゴリ分類（CATEGORY_ORDER）は EventDef に `category` があるか確認。無ければ表示ロジック側で扱いを決める
- events.json 廃止で他の参照が無いか全src再grep（`eventsData` 以外の import含む）
- 行動力不足時（canAct false）の実行抑止は維持

---

## 完了後

- 本プロンプトを `docs/archive/` へ移動
- KNOWLEDGE §8（theater）と §18 残タスク（theater統合）を更新
- イベントシステム刷新 全Phase完了。本体 `PROMPT_event_system_redesign.md` も archive へ
