# コードレビュー記録

進行中のコードレビューで発見した問題・指摘事項の一覧。
バグ修正プロンプトの素材として使用する。

---

## バグ

### BUG-01: ロードキャンセル時にマップへ遷移する

**ファイル**: `src/App.jsx`
**深刻度**: 中

**事象**:
タイトル画面で「続きから」を押してSaveSceneを開き、キャンセルまたは✕ボタンを押すと`navigate('map')`が呼ばれる。`startNewGame()`未実行のままMapSceneが開く。

**原因**:
```js
// App.jsx TitleSceneのonNavigate
if (dest === 'save') { navigate('save', { mode: 'load' }); return; }
```
`returnTo`を渡していないため、SaveSceneの`onClose`が`sceneParams.returnTo ?? 'map'`で`'map'`にフォールバックする。

**影響**:
- `game_start`イベントが未発火（シナリオ冒頭ADV・初期フラグスキップ）
- クラッシュはしない。見た目上はゲームが動いているように見える

**修正案**:
```js
if (dest === 'save') { navigate('save', { mode: 'load', returnTo: 'title' }); return; }
```

---

### BUG-02: ロード失敗時に「ロードしました」トーストが出る

**ファイル**: `src/scenes/SaveScene.jsx`
**深刻度**: 低

**事象**:
`handleAction`内でロード成否に関わらず`setToast('ロードしました')`が実行される。`game.actions.load()`がfalseを返す場合（データ破損等）でも成功メッセージが表示される。

**原因**:
```js
if (onLoad) onLoad(selected);
setTimeout(() => { setBusy(false); setToast('ロードしました'); ... }, 350);
```
`onLoad`の戻り値を見ていない。ロード成功時はそもそも`navigate('map')`で画面遷移するためトーストは表示されないが、失敗時に誤表示される。

**修正案**:
`onLoad`をasync化してbooleanを返させ、falseの場合はエラートーストを出す。

---

## 設計上の問題

### DESIGN-01: 未実装シーンへのメニューリンク

**ファイル**: `src/scenes/TitleScene.jsx`

`gallery`・`settings`・`credits`がメニューに常時表示されているが、App.jsxでは「未実装」プレースホルダーのみ。ユーザーが押すと「gallery（未実装）」画面が出る。

---

### DESIGN-02: `onUpgradeロジック`がApp.jsxに存在する

**ファイル**: `src/App.jsx` （case 'characters'）

キャラアップグレードのコスト計算・SP補充ロジックがApp.jsxのrenderScene内にある。GameContextのactionに移すべき責務。

---

### DESIGN-03: `buildDungeonEnemy`がApp.jsxに存在する

**ファイル**: `src/App.jsx`

ダンジョン敵キャラのビルド関数がApp.jsxのトップレベルにある。DungeonSceneまたはGameContext側に持たせる方が責務として適切。

---

### DESIGN-04: `checkVictoryCondition`の二重計算

**ファイル**: `src/context/GameContext.jsx` （`battleEnd`内）

`battleEnd`内で`nextState`を手動構築して勝敗判定している。`flushSync`でdispatch後にstateRefを確定させれば不要になる構造的負債。

---

## コーディングルール違反

### LINT-01: 直書きカラーがトークン化されていない

**ファイル**: `src/scenes/TitleScene.jsx`

`rgba(196,66,122,...)`はトークン`PK`と同値だが直書きされている箇所が複数ある。
背景グラデーションの`#2a1830`・`#14091e`・`#08050f`もトークン未定義のベタ書き。

---

### LINT-02: 未使用import

| ファイル | 未使用 |
|----------|--------|
| `TitleScene.jsx` | `TopBar`、`PK2`・`TEAL`・`TX`・`TXD`・`TXF`・`BR`・`glass`・`GAME_STATE`・`ROLES`・`CHARS` |
| `SaveScene.jsx` | `TopBar`、`AC`・`AC2`・`PK2`・`GAME_STATE`・`ROLES` |

---

### LINT-03: `Object.assign(window, { ... })`

**ファイル**: `TitleScene.jsx`・`SaveScene.jsx`

デバッグ用のwindowグローバル汚染が本番コードに残っている。

---

### LINT-04: 未使用state

**ファイル**: `src/scenes/SaveScene.jsx`

`const [_dummy, setDummy] = useState(0)`がどこからも使われていない。

---

## 軽微な指摘

### NOTE-01: DEMO_SLOTSが残っている

**ファイル**: `src/scenes/SaveScene.jsx`

`slotsProp`未渡し時のフォールバック用ハードコードデータ。App.jsxは常にslotsを渡すため実使用なし。

---

### NOTE-02: location・leaderフィールドの廃止 → CLEANUP-01に昇格

→ 後述CLEANUP-01参照。

---

### NOTE-03: アニメーション定義がグローバルCSS依存

**ファイル**: `src/scenes/TitleScene.jsx`

`fadeIn`・`fadeUp`キーフレームはこのファイルに定義されておらずグローバルCSSに依存。定義元が消えると動かなくなる。

---

### NOTE-04: `syncLegionAI()`の手動呼び出し

**ファイル**: `src/context/GameContext.jsx`

非同期action冒頭で毎回手動呼び出しが必要。追加実装時に忘れると古いcharsでAIが動く。

---

### NOTE-06: BottomBarのPartyシーン「編成済み7人」表示

**ファイル**: `src/shared/SharedUI.jsx`

BottomBarの`isParty`分岐で`CHARS.filter(c=>c.joined).length`（モック固定値=7）を表示。
右上TopBarに実データの仲間数（10）が既に表示されており重複かつ誤情報。→ CLEANUP-02で削除。

---

### NOTE-05: `doResearch`と`startResearch`の並立

**ファイル**: `src/context/GameContext.jsx`

`doResearch`は即時完了、`startResearch`はキュー式。呼び分けルールがコメントにない。

---

## クリーンアップ

### CLEANUP-01: SaveSceneのlocation・leader廃止

**ファイル**: `src/scenes/SaveScene.jsx`、`src/context/GameContext.jsx`

**廃止対象**:

1. `SaveScene.jsx`
   - `location`・`leader`フィールドの表示ロジック削除（サムネイル・location表示部）
   - `CHARS`のimportと参照削除（leaderサムネイル用途のみ）
   - `DEMO_SLOTS`削除（実使用なし・IDも実データと不一致）
   - `_dummy` state削除

2. `getSaveSlots()`（`GameContext.jsx`）
   - `meme`は`pf.treasury`で取得可能なため追加する
   - `location`・`leader`はセーブデータに存在しないため追加しない

**`getSaveSlots`修正案**:
```js
return {
  slot,
  empty:   false,
  turn:    d.currentTurn,
  savedAt: d.savedAt,
  bases:   `${d.bases?.filter(b => pf && b.factionId === pf.id).length ?? 0}`,
  meme:    pf?.treasury ?? 0,   // 追加
};
```

---

### CLEANUP-02: BottomBar「編成済みX人」表示の削除

**ファイル**: `src/shared/SharedUI.jsx`

**対象**:
BottomBarの`isParty`分岐内の以下の要素を削除する。

```jsx
<div style={{fontSize:10, color:TXF, fontFamily:"'Noto Sans JP'"}}>
  編成済み：{CHARS.filter(c=>c.joined).length} 人
</div>
```

CLEANUP-01でSaveSceneの`CHARS`参照が消えた後、BottomBarが`CHARS`の唯一の参照元になる。この表示を削除することで`CHARS`のimportも不要になる。

---

## ADVScene.jsx

### BUG-03: CHAR_ID_MAPに未登録のキャラは立ち絵・スピーカータグが出ない

**ファイル**: `src/scenes/ADVScene.jsx`
**深刻度**: 中

`char_008`（琴葉茜）・`char_009`（琴葉葵）等がCHAR_ID_MAPに未登録。
`ev_turn1_status`でこの2キャラが話者として登場する可能性があるが、`getChar()`がnullを返し立ち絵なし・スピーカータグなしで表示される。
新キャラ追加のたびに手動追記が必要で、漏れが発生しやすい構造。

---

### NOTE-07: ADVSceneのデバッグ用モックデータ残存

**ファイル**: `src/scenes/ADVScene.jsx`

`DEMO_CAST`・`DEMO_BG`・`DEMO_LOCATION`・`DEMO_SCENARIO`が残っている。実使用なし。
末尾の`Object.assign(window, { ADVScene, DEMO_SCENARIO })`でwindowにも露出している。

---

### NOTE-08: transparentモードが機能していない

**ファイル**: `src/scenes/ADVScene.jsx`、`src/App.jsx`

`transparent`の設定経路が2つある（propとscript.meta）が、App.jsxはどちらも使っていない。常に`false`で透過モードは未使用状態。

---

### NOTE-09: SKIPボタンと右クリックスキップの挙動の違い

**ファイル**: `src/scenes/ADVScene.jsx`

- SKIPボタン（ADVTopBar）: `finish()`を直接呼ぶ → ADVを即終了
- 右クリック: 次のnarrationかendまでdialogをスキップ → ADV内で継続

ユーザーから見ると同じ「スキップ」だが挙動が異なる。ラベルで区別するか、挙動を統一する必要がある。

---

## ターン管理

### BUG-04: ターン1のplayer_turnイベントが永遠に発火しない

**ファイル**: `src/context/GameContext.jsx`、`src/game/data/events/system/ev_turn1_status.json`
**深刻度**: 中

**事象**:
`startNewGame()`はgame_startイベント発火後に`navigate('map')`するが`startPlayerTurn()`を呼ばない。`startPlayerTurn()`は`handleNextTurn()`（ターン終了ボタン）の末尾でのみ呼ばれる。初回マップ表示時点でターン1の`player_turn`イベントは未発火のまま。

**修正方針**:
1. `createInitialState()`の`currentTurn`を`0`に変更
2. `startNewGame()`の末尾でgame_startイベント発火後に`startPlayerTurn()`を呼ぶ
3. `startPlayerTurn()`内の`NEXT_TURN`dispatchでターン1になり`player_turn`イベントが正規発火する

```
startNewGame()
  → game_startイベント発火
  → startPlayerTurn()  ← 追加
    → NEXT_TURN: currentTurn 0→1
    → player_turnイベント発火
  → navigate('map')
```

**注意点**:
- `ev_turn1_status`のtriggerが現在`game_start`。修正後は`player_turn`＋`turn==1`条件に移す必要がある
- 既存イベントのturn条件（`ev_turn2_join_kotohaxsisters`等）がずれないか全イベントJSON確認が必要

---

## MapScene.jsx

### DESIGN-05: NodePopupの廃止・クリックで即BaseMenuScene遷移

**ファイル**: `src/scenes/MapScene.jsx`

現状ノードクリックでポップアップが開き、そこから「詳細を見る」「攻撃する」の2択になっている。
攻撃への経路が2つある（ポップアップ直行 / BaseMenuScene経由）。

**方針**: ポップアップを廃止し、ノードクリックで即BaseMenuSceneへ遷移する。
`handleNodeClick`から`onNodeClick`（→BaseMenuScene）を直接呼ぶ。

---

### DESIGN-06: NodePopupの「防御部隊」表示がbattleCapacityを誤表記

**ファイル**: `src/scenes/MapScene.jsx`

```js
troops: b.soldiers ?? b.battleCapacity ?? 400,
```

bases.jsonに`soldiers`フィールドは存在しない。常に`battleCapacity`の値が入るが、ラベルは「防御部隊 X兵」と表示している。`battleCapacity`は兵数ではなく戦闘域（SPがこの値を下回ると参戦状態になる閾値）。表示ラベルを「戦闘域」に修正し、値も`battleCapacity`を直接参照すべき。MapScene・BaseMenuScene両方に同じ問題がある。

---

### BUG-05: ダンジョンへの経路がマップに存在しない

**ファイル**: `src/scenes/MapScene.jsx`、`src/scenes/BaseMenuScene.jsx`

MapSceneからダンジョンに行く経路はNodePopup経由の「詳細を見る」→BaseMenuScene→ダンジョンボタンのみ。
DESIGN-05でNodePopupを廃止してノードクリック即BaseMenuScene遷移にすれば経路は維持される。ただしBaseMenuSceneのダンジョンボタン表示条件（`hasDungeon`prop）が正しく渡されているか確認が必要。

---

## BaseMenuScene.jsx

### CLEANUP-03: 「訪問」ボタンの廃止

**ファイル**: `src/scenes/BaseMenuScene.jsx`

KNOWLEDGE.md: `base_visit`は「訪問UI未実装・ディレクター判断待ち」と記載。
方針として訪問は劇場（TheaterScene）に集約済み。

`cmds`配列から`visit`エントリを削除する。
App.jsxの`onNavigate`で`dest:'adv'`が`navigate('adv', { node })`に落ちて空scriptでADVが起動するバグも同時に解消される。

---

### CLEANUP-04: `node.owner`・`ally`・`neutral`分岐の削除

**ファイル**: `src/scenes/BaseMenuScene.jsx`

```js
const ownerKey = node.owner || (isOwned ? 'player' : 'enemy');
```

`node.owner`はMapSceneの`liveNodes`に存在しないフィールドで常にundefined。`ally`・`neutral`分岐も現在のGameContextに友軍・中立の概念が未実装なため機能しない。

`ownerKey`・`ownerColor`・`ownerLabel`の計算を`isOwned`のbooleanに一本化する。

---

### CLEANUP-05: `ownerLabel`の「東北家」直書き

**ファイル**: `src/scenes/BaseMenuScene.jsx`

```js
const ownerLabel = ownerKey === 'player' ? '東北家' : ...
```

プレイヤー勢力名が直書き。`node.factionName`（App.jsxから渡されるnodeに含まれる）を使うべき。

---

### NOTE-10: `isOwned=true`かつ`canAttack=true`は現状発生しない

**ファイル**: `src/scenes/BaseMenuScene.jsx`

BaseMenuSceneのコマンド生成は`isOwned=true`のとき攻撃ボタンを出す分岐を持つが、MapSceneの`canAttack`計算は`!isPlayer`を先頭条件に持つため自拠点では必ずfalse。この分岐は現状dead code。

---

## マップUI改善方針

### DESIGN-07: Legendの廃止

**ファイル**: `src/scenes/MapScene.jsx`

左上のLegendコンポーネント（勢力カラー一覧）は不要。削除する。

---

### DESIGN-08: MiniMapの機能強化

**ファイル**: `src/scenes/MapScene.jsx`

現状のMiniMapは表示のみ（クリック・ホバー操作不可）。

**追加仕様**:
- マウスオーバーで拡大表示
- MiniMap上をクリック/ドラッグしてメインマップの表示位置を移動できる

---

### DESIGN-09: BOUNDARY_Xの境界線グローを廃止

**ファイル**: `src/scenes/MapScene.jsx`

`BOUNDARY_X=2400`に縦グローを描画しているが設計意図がコメントに記載なし。背景をSVGから実背景画像に差し替えるタイミングで合わせて削除する。

---

### DESIGN-10: BottomBarに「タイトルへ戻る」を追加

**ファイル**: `src/shared/SharedUI.jsx`（BottomBar）、`src/App.jsx`

マップ画面のBottomBarメニューに「タイトルへ戻る」ボタンを追加する。

**仕様**:
- ボタン押下で確認ダイアログを表示（「タイトルに戻りますか？セーブはされません」）
- 「はい」でタイトルへ遷移（`navigate('title')`）
- 「いいえ」でダイアログを閉じる

---

## ItemsScene.jsx

### CLEANUP-06: 売却ボタンの廃止

**ファイル**: `src/scenes/ItemsScene.jsx`

売却ボタンは`onRemoveItem`（インベントリから削除するだけ）を呼ぶのみでミーム加算処理がない。売却機能として未完成のため廃止する。

---

### NOTE-12: 装備操作がどこにも実装されていない

**ファイル**: `src/scenes/ItemsScene.jsx`、`src/context/GameContext.jsx`

`equipment`フィールドはGameContextのシリアライズ・デシリアライズに含まれており、ItemsScene・PartySceneで「装備中キャラ」の表示参照はある。しかし装備を付けたり外したりするUIもアクションも存在しない。`UPDATE_CHAR`dispatchで実装可能な状態だが呼び出す口がない。将来実装待ち。

---

### NOTE-13: ItemsSceneがBottomBarを使わず独自実装

**ファイル**: `src/scenes/ItemsScene.jsx`

下部ナビを`BottomBar`コンポーネントではなく独自のdivで実装している。見た目は同じだが共通化されていない。

---

### NOTE-14: 装備スロットは1枠のみ・装備UIの設計が必要

**ファイル**: `src/game/data/characters.json`、`src/scenes/ItemsScene.jsx`

characters.jsonの`equipment`フィールドは`{ "item": null }`の1スロット構造。複数装備は想定外。
装備操作UIの実装時はItemsSceneまたはPartySceneのCharDetailで「装備する/外す」ボタンを追加し、`UPDATE_CHAR`dispatchで`equipment.item`を更新する設計が適切。

---

## ResearchScene.jsx

### NOTE-15: LAYOUTハードコードとfacilities.jsonの二重管理

**ファイル**: `src/scenes/ResearchScene.jsx`

```js
const LAYOUT = { voice_1: [0, 0], terms: [0, 1], ... };
```

研究ノードの座標が全てハードコード。`facilities.json`のデータと二重管理。新しい研究を追加するとき両方の更新が必要。`LAYOUT`に未登録のIDは`nodePos()`が`[0,0]`にフォールバックし全ノードが左上に重なるサイレントバグになる。

`facilities.json`の各研究定義に`col`・`row`フィールドを追加してLAYOUTを廃止するか、または`buildingSystem`側でレイアウト情報を持つ設計が適切。

---

### NOTE-16: ResearchSceneもBottomBarを使わず独自実装

**ファイル**: `src/scenes/ResearchScene.jsx`

ItemsSceneと同じパターン。下部ナビを独自divで実装。

---

## TheaterScene.jsx

### NOTE-17: `getTheaterEvents`・`runTheaterEvent`の実装未確認

**ファイル**: `src/scenes/TheaterScene.jsx`、`src/context/GameContext.jsx`

App.jsxから`game.actions.getTheaterEvents()`・`game.actions.runTheaterEvent(eventId)`が呼ばれる。GameContextへの実装状況未確認。

---

### NOTE-18: TheaterSceneもBottomBarを使わず独自実装

**ファイル**: `src/scenes/TheaterScene.jsx`

ItemsScene・ResearchSceneと同じパターン。下部ナビを独自divで実装。3シーンで同じ問題が発生しており、BottomBar共通化の対象。

---

### BUG-08: `story`カテゴリのイベントが劇場に表示されない（QA確認済み）

**ファイル**: `src/scenes/TheaterScene.jsx`、`src/game/data/events/theater/`

`ev_theater_kotoha_sisters`・`ev_theater_chanko`のcategoryが`story`だが、TheaterSceneの`CATEGORY_ORDER`は`['visit','main','character','recurring']`のみで`story`が存在しない。`groups[cat]?.length`が0になりグリッドに描画されない。

**修正案**: `CATEGORY_ORDER`に`'story'`を追加、`CATEGORY_LABEL`に`story:'ストーリー'`を追加。またはイベントJSON側のcategoryを`character`に変更する。

**原則**: 実データに存在するフィールドのみ表示する。実データにないフィールドは表示しない。実データにあるフィールドは表示されるべき。

### BUG-06: `joined`フィールドが実データに存在しない

**ファイル**: `src/scenes/PartyScene.jsx`

```js
joined: c.joined ?? true,
```

`joined`はCHARSモックのフィールド。実データ（characters.json）には存在しない。`?? true`で全員trueにフォールバックしており誤り。

加入判定の正規実装は`factionId === playerFaction.id`。ただしApp.jsxがPartySceneに渡す`characters`は既に`factionId === playerFaction?.id`でフィルタ済みのため、渡ってきたキャラは全員加入済みとして扱えばよい。`joined`フィールドの参照を全て削除し、渡ってきたキャラをそのまま使う。

---

### BUG-07: LeftPanel・CharDetailのフィールドが実データにない

**ファイル**: `src/scenes/PartyScene.jsx`
**原則**: 実データに存在するフィールドのみ表示する。実データにないフィールドは表示しない。実データにあるフィールドは表示されるべき。

| フィールド参照 | 実データ | 対応 |
|--------------|---------|------|
| `char.joined` | なし | App.jsxが加入済みのみ渡すので参照削除 |
| `char.origin` | なし | NameItem・CharDetailから削除 |
| `char.quote` | なし | `char.description`で代替 |
| `char.skill` | `skillId`のみ | skills.jsonから名前・説明を引く |
| `char.skillDesc` | なし | skills.jsonから引く |
| `char.atk` / `char.def` | `charAttack` / `charDefense` | マッピング修正（`allChars`変換時） |
| `char.meme` / `char.memeMax` | `soldiers` / `maxSoldiers` | マッピング修正（`allChars`変換時） |

skillsデータは`systemsRef.current.skills`に保持済み。App.jsxからPartySceneに`skills`propとして渡す必要がある。

---

### NOTE-11: `ROLES`・`CHARS`トークン依存がPartySceneに残存

**ファイル**: `src/scenes/PartyScene.jsx`

`ROLES`（カラー定義）・`CHARS`（モックキャラ）をimportしている。
`ROLES`はカラートークンとして使用中（`role.color`・`role.bg`・`role.label`）。実データの`role`値（`attacker`等）を`ROLE_MAP`でtokens.jsキー（`front`等）に変換してから参照している。
`CHARS`は`characters`prop未渡し時のフォールバックとして残存。App.jsxは常にpropsを渡すため実使用なし。

---

## PartnerWidget.jsx

### DESIGN-11: PartnerWidgetの表示方針を決定する必要あり

**ファイル**: `src/shared/PartnerWidget.jsx`

**現状の問題**:
- 秘書立ち絵が80×160pxで小さく視認性が低い
- 全シーンで左下に常時表示されるためボタンと重なる（研究・アイテム・仲間等）
- 防衛プロンプトも同じPartnerWidgetで表示されている（意図せず秘書と同じ仕組み）

**検討事項**（ディレクター判断待ち）:

| 案 | 内容 |
|----|------|
| A: マップシーンのみ表示 | 他シーンでは非表示。防衛プロンプトはマップ上でのみ発生するため問題なし |
| B: ナビゲート機能付きで全シーン表示 | 研究・アイテム・拠点詳細等のショートカットを秘書に持たせる |
| C: 廃止 | 防衛プロンプトは別途専用UIで実装 |

**拠点詳細への応用**:
防衛プロンプトと同じ仕組みで拠点詳細をPartnerWidget経由で表示するアイデアあり。BaseMenuSceneへの遷移不要になる可能性。

---

### NOTE-19: secretaryLinesがchar_001のみ定義

**ファイル**: `src/game/data/secretary_lines.json`

`char_001`のみセリフが定義されており、他キャラを秘書に設定するとセリフが一切出ない。

---

### NOTE-20: コンテキストセリフ6種類がPartnerWidgetに未接続

**ファイル**: `src/game/data/secretary_lines.json`、`src/shared/PartnerWidget.jsx`

`secretary_lines.json`には以下のコンテキストが定義されているがPartnerWidgetは`idle`と`defense_prompt`しか使っていない。

| キー | タイミング |
|------|----------|
| `turn_start` | ターン開始時 |
| `attack_select` | 攻撃拠点選択時 |
| `upgrade_select` | 強化選択時 |
| `research_start` | 研究開始時 |
| `theater_open` | 劇場を開いたとき |
| `turn_end` | ターン終了時 |

DESIGN-11の方針決定後、残す場合は接続する。

---

## DungeonScene.jsx

### NOTE-21: `onDefeat`のpenaltyTurns設定がApp.jsx側で未確認

**ファイル**: `src/scenes/DungeonScene.jsx`、`src/App.jsx`

UIに「2ターンの休養が必要です」と表示されるが、`onDefeat`コールバックでGameContextの`penaltyTurns=2`が実際にセットされているか未確認。

---

### NOTE-22: `dungeonExploredThisTurn`のセットタイミング未確認

**ファイル**: `src/scenes/DungeonScene.jsx`、`src/context/GameContext.jsx`

1ターン1回制限フラグ。`onFloorClear`または`onStartBattle`のどちらでセットされるか未確認。

---

### NOTE-23: floor_introの敵兵力表示とbuildDungeonEnemyの整合確認が必要

**ファイル**: `src/scenes/DungeonScene.jsx`、`src/App.jsx`

`floorData?.enemy?.soldiers`を表示しているが、`buildDungeonEnemy`（App.jsx）が生成する敵オブジェクトのフィールド構造と一致しているか未確認。

---

## FormationScene.jsx

### NOTE-24: `troops`参照がFormationSceneにも残存

**ファイル**: `src/scenes/FormationScene.jsx`

```js
const sp = char.soldiers ?? char.troops ?? 0;
```

MapScene・BaseMenuSceneと同じパターン。`troops`は実データに存在しない。

---

### NOTE-25: `isDefense`時の「戻る」ボタンが条件分岐で重複

**ファイル**: `src/scenes/FormationScene.jsx`

`isDefense ? <戻る> : <戻る>`で同じボタンを条件分岐で2重定義している。共通化可能。

---

### NOTE-26: `strategyRate`ボーナス計算がBattleEngineV3と一致するか未確認

**ファイル**: `src/scenes/FormationScene.jsx`、`src/game/systems/BattleEngineV3.js`

FormationSceneの表示上は`diff>50→+50%、それ以外→+10%`の2段階。BattleEngineV3の実計算と一致しているか未確認。乖離があると表示と結果が食い違う。

→ **確認済み**: 両方とも`diff>50→50%、それ以外→10%`で一致。ただしBattleEngineV3には`Math.random() < (diff - 50) / 100`の確率判定があり、`diff>50`でも50%ボーナスが必ず発生するわけではない。FormationSceneの表示はこの確率を無視して「+50%」と表示する。表示は「最大値」を示していると解釈できる範囲でバグではないが、確率要素が表示に反映されていない点は説明不足。

---

### MISSING-01: プレイヤー攻撃時に敵の野戦OR籠城選択が未実装

**ファイル**: `src/game/systems/LegionAI.js`、`src/App.jsx`
**深刻度**: 中

プレイヤーが防衛するとき（`isDefense=true`）はFormationSceneで野戦OR籠城を選択できる。しかしプレイヤーが攻撃するとき、敵が野戦OR籠城を選択する処理がない。

- LegionAIに防衛モード選択のメソッドが存在しない
- App.jsxは`battleCapacity`として常に`targetNode.battleCapacity`（籠城値）を渡す

結果として敵は常に籠城扱いになる。野戦を選ぶ敵AIが存在しない。

**実装方針**:
LegionAIに`chooseDefenseMode(defenderFactionId, defenderBase, attackerSoldiers)`を追加。SPの差・拠点の戦略的重要度等をもとに`'siege'`or`'field'`を返す。App.jsxのbattle遷移時に`battleCapacity`を分岐させる。

---

## BattleScene.jsx

### BUG-09: FormationSceneで選択したbattleCapacityがBattleEngineに届いていない

**ファイル**: `src/scenes/BattleScene.jsx`、`src/App.jsx`
**深刻度**: 高

FormationSceneは`effectiveBattleCapacity`（野戦なら5000、籠城なら拠点値）を計算して`onLaunch`に渡している。App.jsxは`sceneParams.battleCapacity`としてBattleSceneに渡しているが、BattleSceneのpropsに`battleCapacity`が定義されていない。

BattleFlow内部では：
```js
const BATTLE_CAP = targetNode?.battleCapacity ?? 400;
```
`targetNode.battleCapacity`（常に籠城値）を直接参照している。

**結果**: プレイヤーが防衛で「野戦で迎撃」を選択しても戦闘域が5000にならず、常に拠点の籠城値が使われる。野戦選択が完全に無効。

**修正方針**:
BattleFlowのpropsに`battleCapacity`を追加し、`BATTLE_CAP`の計算を以下に変更する。
```js
const BATTLE_CAP = battleCapacity ?? targetNode?.battleCapacity ?? 400;
```

---

### NOTE-27: `quotes`フィールドが実データにない

**ファイル**: `src/scenes/BattleScene.jsx`

`quotes.strategy`・`quotes.attack`・`quotes.special`・`quotes.defeat`をcharactersから参照しているがcharacters.jsonに`quotes`フィールドは存在しない。全てフォールバック固定文字列が使われる。将来実装待ち。

---

### NOTE-28: 「東北家」直書き・`buildDefaultEnemies`重複

**ファイル**: `src/scenes/BattleScene.jsx`

- BActionSceneのTopBarに「東北家」がハードコード（BaseMenuScene・FormationSceneと同パターン3件目）
- `buildDefaultEnemies`がBattleScene内とApp.jsx内の両方に存在（DESIGN-03と同根）

---

### CLEANUP-07: 必殺・特技システムの整理（別途設計後に実装）

**ファイル**: `src/game/systems/BattleEngineV3.js`、`src/game/systems/BattleAI.js`、`src/game/data/skills.json`、`KNOWLEDGE.md`

**用語再定義**:
- 「必殺」= instant型（即時発動）とcharge型（集中→発動）の総称。全てダメージを与えるものに統一
- 「特技」という呼称は廃止

**現状の問題**:
1. instant型はUI経路がなく実質機能しない。ただし効果が正しく出ない状態（`_fortress`が必殺を貫通する等）のまま残すとバグの温床になる
2. どのキャラがどの必殺を使えるかの条件付けが不明瞭（characters.jsonの`skillId`フィールドへの割り当て未整理）
3. BattleEngineV3内で必殺の効果をハードコーディングしている（`_execInstant`の`switch(skill.id)`等）。エンジンが個別効果を知るべきでない

**方針**: 必殺システムは別途設計を整理した上でCodeへ渡す。現時点では以下を保留中とする。

**KNOWLEDGE.mdの修正対象**:
- §11の「特技」という呼称を「必殺」に統一
- instant/charge両型の定義を明記
- キャラへの割り当てルールを追記

---

## GameEndScene.jsx

### NOTE-29: 「東北の名のもとに」直書き

**ファイル**: `src/scenes/GameEndScene.jsx`

勝利テキストにプレイヤー勢力名が直書き。同パターン5件目。

---

### NOTE-30: `clearedCount`（キャラクリ）の意味・渡し方未確認

**ファイル**: `src/scenes/GameEndScene.jsx`、`src/App.jsx`

「キャラクリ」として表示されているが何を指すか不明。App.jsx側の渡し方を確認する必要がある。

---

## NewGamePlusScene.jsx

### NOTE-31: DEMO_FACTIONSが実データ未接続

**ファイル**: `src/scenes/NewGamePlusScene.jsx`

`unlockedFactions`未渡し時のフォールバックとして`DEMO_FACTIONS`が定義されているが、IDが`c11`・`c15`等モック形式で実データと不一致。`leaderChar`は常にnull。

KNOWLEDGE.mdに「new_game_plus real data wiring」が未完了タスクとして記載されており、現状は未接続。

---

### NOTE-32: `ngpFactionId`をApp.jsxが受け取った後の処理未確認

**ファイル**: `src/scenes/NewGamePlusScene.jsx`、`src/App.jsx`

「決定→」で`onNavigate('map', { ngpFactionId: sel.id })`を呼ぶが、App.jsxのマップ遷移処理で`ngpFactionId`を使って何をするか未確認。

---

## src/assets

### CLEANUP-08: Viteテンプレート残骸の削除

**ファイル**: `src/assets/hero.png`、`src/assets/react.svg`、`src/assets/vite.svg`

Viteデフォルトテンプレートの残骸。ゲームから参照されていない。削除可能。

---

## src/game/systems

### BuildingSystem.js

研究（旧称:建設）のロジックを担当。GameContextで`systemsRef.current.buildingSystem`として使用中。

実装根拠:
- `getResearchable()` / `research()` → 研究定義取得・実行
- `getUpgradeCommands()` → キャラ固有強化コマンド取得
- `createMobInstance()` → モブキャラ生成
- `getBuildable()`・`build()`・`getBuildingNames()` → 旧称メソッド（`@deprecated`）。呼び出し元がなければ削除可
- `getIncomeBonus()` → 常に0を返す（収入ボーナス研究廃止）。呼び出し元がいれば無駄
- `hasAcademy()` → 常にfalse（calling_allies廃止）。同上

---

### ItemSystem.js

アイテム定義管理・装備操作・効果計算を担当。GameContextで`systemsRef.current.itemSystem`として使用中。

- `equip()`・`unequip()` → 実装済みだがNOTE-12の通りUIから呼ばれていない
- `applyEquipment()` → BattleScene用とコメントがあるが呼び出し元未確認
- `getShopStock()` → ショップUIが存在しない

---

### SaveSystem.js

**死にコード。** GameContext.jsxはSaveSystemをimportしておらず、`serializeState()`・`deserializeToState()`という独自関数でlocalStorageを直接操作している。削除してもゲームは動く。

---

## src/game/data

### factions.json

8勢力定義。`portrait`・`motto`・`leader`フィールドが存在しない。EnemyTurnSceneがこれらを参照しているが常にundefinedになりフォールバック表示（⚔アイコン）が使われる。

---

### companion_lines.json

8トリガー分のコンテキストセリフが`char_001`〜`char_003`の3キャラ分定義されている。`secretary_lines.json`より豊富な状況対応（資金不足・拠点数・制圧後等）を持つ。ただしPartnerWidgetは`secretary_lines.json`を参照しており`companion_lines.json`は**どこからも呼ばれていない可能性が高い。死にデータの可能性あり。**

---

### dungeons.json

`dungeon_001`（龍泉洞・盛岡）のみ定義。5フロア。全フロアの`rewardItemId`・`eventId`がnull。報酬・フロアイベントは未実装。

---

### facilities.json・ResearchSceneのLAYOUT二重管理（NOTE-15再確認）

研究ツリー25件・upgradeCommands2件定義。座標情報（`col`・`row`）はfacilities.jsonに存在しない。ResearchScene.jsxの`LAYOUT`ハードコードと二重管理になっており、新規研究追加時に両方の更新が必要。

---

### items.json

テストアイテム2件のみ。`shopStock`は空配列。実アイテム未定義。`startWithPlayer:true`のアイテムがゲーム開始時にインベントリに入るかどうかはGameContextの`createInitialState`の実装次第（未確認）。

---

### 手動削除済みファイル

- `src/game/data/dialogs/sample.json` → 旧形式ダイアログサンプル。実ゲームと無関係な内容・現行ADVScript形式と不一致。死にデータのため削除
- `src/game/data/test/`（ディレクトリごと） → テスト用JSON5ファイル。src・QAシーン双方から参照なし。削除

---

### CLEANUP-09: SaveSystem.jsの削除

**ファイル**: `src/game/systems/SaveSystem.js`

死にコード。削除可能。

---

## src/game/utils

### BattleBonus.js

`resolveBonus(char, battleType)`はBattleEngineV3でimport・使用中。`bonusSummary`・`bonusPreviewText`・`bonusTextColor`・`bonusSummaryColor`はUIパネル用とコメントにあるが呼び出し元未確認。

---

### CLEANUP-10: ColorTokens.jsの削除

**ファイル**: `src/game/utils/ColorTokens.js`

Phaser版（旧kiritan）のカラー定数ファイル。Phaser用16進数整数（`0xc4427a`形式）を含む。src内から一切参照されていない。現行はtokens.jsで管理。削除可能。

---

## QAシーン

### CLEANUP-11: QAシーン3ファイルの削除

**ファイル**: `src/scenes/BattleFullQAScene.jsx`、`src/scenes/BattleQAScene.jsx`、`src/scenes/WorldMapQAScene.jsx`

App.jsxにimportされているが`renderScene()`内にcaseがなくURLパラメータ分岐も存在しない。完全な死にimport。3ファイルとも削除可能。合わせてApp.jsxのimport行3行も削除する。

---

## 敵ターンフロー設計

### DESIGN-12: 敵ターンフローを勢力単位で完結させる

**ファイル**: `src/App.jsx`、`src/context/GameContext.jsx`

**現状の問題**:
`buildAttackQueue`が全勢力の攻撃を一括構築してからApp.jsx側で勢力フィルタしている。複数勢力が同ターンに攻撃する場合、各勢力の「戦闘前・戦闘後イベント発火ポイント」が存在せず、勢力ごとのターン処理が正しく分離されていない。

**あるべきフロー（勢力ごとに完結）**:
```
for each enemyFaction:
  1. 敵ターンカットイン（EnemyTurnScene）
  2. before_faction_turnイベント発火
  3. LegionAIで当該勢力の攻撃キューを構築
  4. for each attackItem:
       a. battle_startイベント発火（戦闘開始前ポイント）
       b. 防衛プロンプト → FormationScene → BattleScene
       c. battle_endイベント発火（戦闘後ポイント）
       d. 拠点帰属変更・HP/SP書き戻し
  5. after_faction_turnイベント発火
```

**現状との差分**:
- `buildAttackQueue`を勢力ごと呼び出しに変更（`buildAttackQueueForFaction`は既存）
- `battle_start`・`after_faction_turn`トリガーの追加（EventEngine・イベントJSON側も対応要）
- 戦闘後イベント発火ポイントをbattleEnd内から勢力ループに移動

