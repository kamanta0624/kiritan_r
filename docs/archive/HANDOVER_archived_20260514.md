# kiritan / kiritan_r 引き継ぎドキュメント

> 作成: 2026-05-14
> 対象: 次担当テックリード・ClaudeDesign

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| kiritan | Phaser.js 3.60 + Vite + JS ES Modules。本番稼働中 |
| kiritan_r | React 18 + Vite。kiritan のリニューアル版（移行中） |
| 場所 | `/Users/kamatashintarou/MCP_Learning/kiritan/` |
| 場所 | `/Users/kamatashintarou/MCP_Learning/kiritan_r/` |
| 起動（kiritan） | `npm run dev` → localhost:5173 |
| 起動（kiritan_r） | `npm run dev` → localhost:5174 |
| QA環境（kiritan_r） | `http://localhost:5174/?qa=battle` |
| エディタ（kiritan） | `node tools/editor.js` → localhost:3001 |

---

## 2. kiritan（Phaser版）現状

### v0.7 完了済み

- BattleEngineV3 がデフォルトエンジン（`?engineV1=1` で旧に戻せる）
- 作戦システム（strategyRate差分・SPダメージ±10/50%補正）
- 特技システム（instant/charge統合・集中→必殺技）
- 戦闘不能ペナルティ制（charHp<=0→penaltyTurns=2、死亡廃止）
- 戦闘モード区分（normal/dungeon/event）
- WorldMapScene: ターン開始時penaltyTurnsカウントダウン・復帰時HP10%
- 編成・LegionAI: penaltyTurns>0のキャラを戦闘除外
- エディタ: strategyRate / specialType / talkEventId フィールド追加済み

### エンジン切り替え

```
デフォルト   → BattleEngineV3（本番）
?engineV2=1 → BattleEngineV2（検証用）
?engineV1=1 → BattleEngine（旧本番）
```

### 廃止済みファイル（削除可）

`FacilitySystem.js` / `aiLogic.js` / `patch_note.js` / `StatusBar.js`

### 残タスク（kiritan側）

- WorldMapScene 描画分離（MapRenderer.js抽出）← 方針E、着手前に推奨
- BattleEngineV3 QA（戦闘ロジック担当に委譲中）

---

## 3. kiritan_r（React版）現状

### 技術スタック

```
React 18 + Vite（Node v22）
src/context/GameContext.jsx  ← ゲーム状態管理（useReducer）
src/scenes/                  ← 全14シーン
src/shared/tokens.js         ← デザイントークン
src/shared/SharedUI.jsx      ← TopBar / BottomBar / NavButton
src/game/systems/            ← BattleEngineV3等（Phaser非依存）
src/game/data/               ← 全JSONデータ
```

### シーン接続状況

| シーン | UI | GameContext接続 | 状態 |
|--------|----|-----------------|----|
| title | ✅ | ✅ startNewGame / hasSaveData | 完了 |
| map | ✅ | ✅ bases / factions / TopBar | 完了（BottomBar未調査）|
| base_menu | ✅ | ✅ node / isOwned / canAttack | 完了 |
| formation | ✅ | ✅ availableChars / onLaunch | 完了 |
| battle | ✅ | ✅ BattleEngineV3 接続済み | QA中 |
| characters | ✅ | ✅ characters props | 完了 |
| items | ✅ | ✅ inventory props | 完了 |
| research | ✅ | ✅ completedResearch / treasury | 完了 |
| save | ✅ | ✅ slots / onSave / onLoad | 完了 |
| adv | ✅ | ⬜ scenario 未接続（デモのまま） | 未接続 |
| dungeon | ✅ | ⬜ GameContext 未接続 | 未接続 |
| game_end | ✅ | ⬜ 勝敗条件未接続 | 未接続 |
| new_game_plus | ✅ | ⬜ unlockedFactions 未接続 | 未接続 |
| enemy_turn | ✅ | ⬜ 敵AIターン未実装 | 未接続 |
| gallery / settings / credits | ⬜ 空実装 | — | 空実装のまま |

### 未解決バグ

- **MapのBottomBarボタンが押せない**
  - index.css をViteデフォルトからゲーム用リセットに変更済み（255f541）
  - それでも改善しない場合は原因未特定
  - 調査方針: ブラウザDevToolsで `#root` の実際のCSS・レイアウトを確認

- **戦闘が2ラウンドで終了する（QA中）**
  - BattleEngineV3本体は kiritan 側でQA完了済み
  - kiritan_r の BattleQAScene（`?qa=battle`）での挙動が異なる
  - `checkGameOver` の非同期タイミング問題の可能性

### 残タスク（優先度順）

1. BottomBar クリック問題の解消
2. 勝敗判定 → game_end 遷移の実装
3. 敵AIターン（enemy_turn）実装
4. adv / dungeon の GameContext 接続
5. 戦闘QA完了（別担当）

---

## 4. GameContext API

```js
const {
  currentTurn, factions, bases, characters, inventory, research,
  playerFaction, playerBases, income,
  actions: {
    startNewGame, nextTurn,
    battleEnd(result),   // { usedCharIds, deadCharIds, conquered, defenderBaseId, winnerFactionId }
    updateChar(char),
    setFlag(key, val),
    setTreasury(factionId, amount),
    addResearch(id),
    addItem(item),
    removeItem(instanceId),
    conquerBase(baseId, winnerFactionId),
    save(slot),          // slot: 1 | 2 | 3
    load(slot),          // returns boolean
    getSaveSlots(),      // [{ slot, empty, turn, savedAt }]
  }
} = useGame();
```

---

## 5. データ設計

### キャラクターデータ（characters.json）

```js
{
  id, name, status, isTemplate, factionId, isLeader,
  role,        // attacker / guardian / commander
  attackType,  // melee / ranged / song
  soldiers, maxSoldiers, charHp, charMaxHp,
  charAttack, charSong, soldierAtk, soldierDef,
  strategyRate,   // 作戦成功率 0-100
  skillId,        // skills.json 参照
  specialType,    // char_strike / sp_strike（必殺技）
  talkEventId,    // 個別会話イベントID
  penaltyTurns,   // 戦闘不能ペナルティ残ターン
  usedThisTurn,
  battleBonus: { attack: {...}, defense: {...}, dungeon: {...} }
}
```

### 特技（skills.json）

```js
{
  id,      // rally / pierce / fortress / volley / special_char / special_sp
  trigger, // instant（即時）/ charge（集中→必殺技）
  specialType  // charge型のみ: char_strike / sp_strike
}
```

### セーブキー

`kiritan_save_{slot}` （kiritan / kiritan_r 共通）

---

## 6. BattleEngineV3 仕様要点

- N = min(soldiers, battleCapacity) 体が突撃 → N 回判定
- SP命中 + 将軍命中 = N（常に成立）
- 攻撃と反撃は同時算出・同時適用
- 同時HP0 → プレイヤー側を1に補正
- 戦闘不能条件: `charHp <= 0` のみ（SP=0でも将軍HP残存なら継続）
- SP=0の将軍は前線に出ている扱い（`soldiers < battleCapacity`）→ 将軍本人が攻撃・被攻撃
- 戦闘モード: normal（5R/撤退可）/ dungeon（無制限/撤退不可）/ event（設定可）
- `isDead(unit)` = `unit.charHp <= 0`

---

## 7. ファイル構成（kiritan_r）

```
src/
  App.jsx                    ← シーンルーター
  main.jsx                   ← GameProviderラップ
  index.css                  ← ゲーム用グローバルリセット
  context/
    GameContext.jsx           ← useReducer 状態管理
  scenes/
    TitleScene.jsx
    MapScene.jsx
    BaseMenuScene.jsx
    FormationScene.jsx
    BattleScene.jsx           ← BattleFlow（BattleEngineV3統合済み）
    BattleQAScene.jsx         ← V3単体テスト（?qa=battle）
    PartyScene.jsx
    ItemsScene.jsx
    ResearchScene.jsx
    SaveScene.jsx
    GameEndScene.jsx
    DungeonScene.jsx
    NewGamePlusScene.jsx
    ADVScene.jsx
    EnemyTurnScene.jsx
  shared/
    tokens.js                 ← デザイントークン・デモデータ
    SharedUI.jsx              ← TopBar / BottomBar / NavButton
  game/
    data/                     ← 全JSONデータ（bases/characters/factions等）
    systems/
      BattleEngineV3.js       ← 戦闘エンジン（Phaser非依存）
      BattleAI.js
      BuildingSystem.js
      ItemSystem.js
      LegionAI.js
      SaveSystem.js
      EventEngine.js
    utils/
      BattleBonus.js
docs/
  SCENE_FLOW.md              ← 全シーン遷移定義
  CLAUDE_DESIGN_PROMPT.md    ← ClaudeDesign依頼プロンプト
  Game.html                  ← デザインプロトタイプ（ClaudeDesign参照用）
```

---

## 8. 用語統一

| 旧 | 正 |
|----|-----|
| ゴールド / G | ミーム（通貨） |
| 兵士 | SP / ミーム（兵士） |
| 建設 | 研究 |
| 戦死 | 戦闘不能（ペナルティ制） |
| 仲間 | パートナー（常駐UI）|

---

## 9. 注意事項

- `characters_pool.json` は廃止済み（空ファイル）
- `attack`/`defense` フィールドは互換性のため残存。戦闘は `charAttack`/`soldierAtk`/`soldierDef` を使用
- `battleBonus` に `charHp` キーは存在しない（HP補正なし）
- モブインスタンスは `_isMobInstance: true` で識別
- セーブキーは `kiritan_save_{slot}`
- kiritan_r の BottomBar ボタン接続: `'party'` → `'characters'`（App.jsxのcaseに合わせる）
