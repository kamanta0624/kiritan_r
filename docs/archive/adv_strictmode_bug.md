# ADV StrictMode バグ調査メモ

調査日: 2026-05-23

---

## 症状

`ev_000_opening` で3会話ブロック・計5セリフを設定したとき、
**先頭セリフ（`scenario[1]`）がBACKLOGに記録されず、表示もスキップされる。**

---

## 再現条件

- React 18 StrictMode（`src/main.jsx` で有効）
- ADVSceneのscenario先頭が `setup` ステップ
- `setup` の直後に `dialog` ステップが続く

---

## 根本原因

`ADVScene.jsx` の `setup` useEffect:

```js
useEffect(() => {
  if (scenario[idx]?.type === 'setup') {
    setCast(e.cast);
    // ...
    setIdx(i => i + 1);  // ← ここが問題
  }
}, [idx, scenario]);
```

React 18 StrictMode はdev環境で **useEffect をmount時に2回実行（実行→cleanup→再実行）** する。

`idx=0`（setupステップ）のrender:
1. 初回実行: `setIdx(i => i + 1)` → キューに +1 が積まれる
2. cleanup
3. 再実行: `setIdx(i => i + 1)` → キューにさらに +1 が積まれる

結果: `idx: 0 → 2`。`scenario[1]`（最初のdialogステップ）が丸ごとスキップ。

`history` useEffectも `[idx]` dependencyで走るが、
`idx=1` のrenderが発生しないため「テスト！！」がhistoryに追加されない。

---

## 影響範囲

- 全eventの**最初のセリフが常にスキップされる**
- BACKLOGにも記録されない
- 本番ビルド（StrictModeが外れる）では再現しない可能性があるが、
  devで常時発生するため実質的にADV開発・確認が機能しない状態

---

## 修正方針（案）

**A案: setup処理をuseEffect外に移す（推奨）**

`convertEventScript` の戻り値から setupステップを除去し、
初期cast・bg・locationを `ADVScene` の props または `useMemo` で初期値として渡す。
`setup` useEffectごと削除できるため根本解決。

**B案: 二重実行ガード**

```js
const setupDone = useRef(false);
useEffect(() => {
  if (setupDone.current) return;
  if (scenario[idx]?.type === 'setup') {
    setupDone.current = true;
    setCast(...);
    setIdx(i => i + 1);
  }
}, [idx, scenario]);
```

シンプルだが `scenario` が切り替わったとき（同一ADVSceneインスタンスで別シナリオを渡す設計の場合）にリセットが必要。
現状 `scenario` は `navigate('adv', ...)` のたびに新インスタンスが渡るため、
ADVScene自体が再マウントされれば `useRef` もリセットされる。
App.jsx の case 'adv' に `key={sceneParams.scenario}` を付ければ保証できる。

---

## 担当

エディタとは無関係。`src/scenes/ADVScene.jsx` の修正タスク。
別チャットで検討・実装。
