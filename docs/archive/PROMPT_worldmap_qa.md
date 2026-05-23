# PROMPT: ワールドマップ QAページ作成

> 作成: 2026-05-20
> 担当: ClaudeCode
> 完了後: docs/archive/ へ移動

---

## 作業概要

ワールドマップ関連のバグ3件を検証するQAページを作成する。
`?qa=worldmap` で起動する `WorldMapQAScene.jsx` を新規作成し、App.jsx に組み込む。

**検証対象バグ:**
- [B01] ターン数が増えない
- [B02] 防衛撤退で都市の所有権が移らない
- [B03] 敵ターン順序（カットイン→マップ復帰→防衛編成 になっている）

---

## ファイル構成

```
src/scenes/WorldMapQAScene.jsx   ← 新規作成
src/App.jsx                      ← QAルート追加
```

---

## WorldMapQAScene.jsx の仕様

### 概要

- `useGame()` でGameContextに直接アクセスし、各アクションを手動実行する
- 各テストの `PASS / FAIL / PENDING` をリアルタイム表示
- 実行前後の state スナップショットを並べて表示する
- 「全件実行」で全テストを順番に自動実行する

### テスト一覧（13件）

```
[T01] nextTurn() → currentTurn が +1 される
[T02] nextTurn() → playerFaction.treasury に収入が加算される
[T03] nextTurn() → usedThisTurn が false にリセットされる
[T04] nextTurn() → penaltyTurns が 1 減る（0未満にならない）
[T05] nextTurn() 戻り値 → attackQueue が配列である
[T06] battleEnd conquered:true → bases の factionId が winnerFactionId に変わる
[T07] battleEnd conquered:false → bases の factionId が変わらない
[T08] battleEnd deadMobIds → characters から該当IDが除外される
[T09] attackQueue → EnemyTurnScene に渡る前に defenseQueue に格納される
[T10] launchNextDefense → キュー1件消費後に scene が 'formation' になる
[T11] launchNextDefense → キューが空になると scene が 'map' になる
[T12] isAtWar() → atWarWith に含まれる勢力でtrueを返す
[T13] onPlayerTurnStart() → 例外なく完了する（EventEngine player_turn 発火）
```

### テスト実装のポイント

各テストは以下のパターンで実装する：

```jsx
async function runT01() {
  const before = game.currentTurn;
  await game.actions.nextTurn(() => {});
  const after = game.currentTurn; // stateRefから取得
  return after === before + 1
    ? { result: 'PASS', detail: `${before} → ${after}` }
    : { result: 'FAIL', detail: `${before} → ${after}（変化なし）` };
}
```

**注意**: `useGame()` の state はReactのレンダリングサイクルに依存するため、`nextTurn()` await後の値は `stateRef.current` ではなく再レンダリング後のstateを確認する必要がある。テスト関数は `useState` でテスト結果を管理し、ボタンクリック → 非同期実行 → setState で結果を更新するパターンにする。

`currentTurn` の変化はボタン押下後の次レンダリングで確認するため、各テストは「実行」→「確認」の2ステップにするか、`useEffect` で変化を検知する設計でも可。

### UI構成

```
┌─────────────────────────────────────────────────────┐
│ WORLD MAP QA  [全件実行]  [リセット]     ← ヘッダ   │
├─────────────────┬───────────────────────────────────┤
│ テスト一覧      │ State スナップショット             │
│ [T01] ●PASS    │ currentTurn: 3                     │
│ [T02] ●FAIL    │ playerTreasury: 1200               │
│ [T03] ●PEND    │ bases[0]: { factionId:'東北家' }   │
│ ...            │ defenseQueue: []                   │
│                │ scene: 'map'                       │
│ [実行] [T01]   │                                    │
└─────────────────┴───────────────────────────────────┘
```

- 左ペイン: テスト一覧。各行に「実行」ボタン。結果は色で表示（PASS=緑、FAIL=赤、PENDING=グレー）
- 右ペイン: 現在のstate主要フィールドをリアルタイム表示
- ヘッダ: 「全件実行」「リセット（startNewGame）」ボタン

### コンポーネント構造

```jsx
export default function WorldMapQAScene({ onBack }) {
  const game = useGame();
  const [results, setResults] = useState({});  // { T01: { result, detail }, ... }
  const [running, setRunning] = useState(false);

  // scene遷移をシミュレートするための内部state
  const [mockScene, setMockScene] = useState('map');
  const [mockDefenseQueue, setMockDefenseQueue] = useState([]);

  // 各テスト関数
  // ...

  return (/* UI */);
}
```

**T09〜T11のシーン遷移テスト**:
実際のApp.jsxのnavigateには触れず、QAシーン内で `mockScene` / `mockDefenseQueue` を持ち、`launchNextDefense` 相当のロジックを内部で再現して検証する。

### 全件実行の順序

T01〜T13を順番に実行。各テスト間に `await new Promise(r => setTimeout(r, 300))` を挟んでstate更新を待つ。全件完了後にサマリー（PASS数/FAIL数）を表示。

---

## App.jsx への組み込み

```jsx
import WorldMapQAScene from './scenes/WorldMapQAScene.jsx';

// QAルート（既存のQA判定の直後に追加）
if (qaParam === 'worldmap') {
  return <div id="app-root"><WorldMapQAScene onBack={() => window.history.back()} /></div>;
}
```

---

## 動作確認手順

```
http://localhost:5174/?qa=worldmap
```

1. 「全件実行」を押してT01〜T13が全てPASSすることを確認
2. FAILしたテストの `detail` 欄でバグの内容を特定
3. バグ修正後に再実行してPASSに変わることを確認

---

## 修正が必要になった場合の対応

QAで判明したバグはこのプロンプトに追記せず、別途 `PROMPT_worldmap_bugfix.md` を作成して対応する。
